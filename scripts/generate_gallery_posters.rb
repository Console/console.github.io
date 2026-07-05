#!/usr/bin/env ruby

require "fileutils"
require "open3"
require "yaml"
require "date"

ROOT = File.expand_path("..", __dir__)
GALLERIES_DIR = File.join(ROOT, "_galleries")
TIMESTAMP = "00:00:02"

def parse_front_matter(path)
  content = File.read(path)
  match = content.match(/\A---\s*\n(.*?)\n---\s*\n/m)
  return {} unless match

  YAML.safe_load(match[1], permitted_classes: [Time, Date], aliases: true) || {}
end

def resolve_site_path(site_path)
  normalized = site_path.start_with?("/") ? site_path[1..] : site_path
  File.join(ROOT, normalized)
end

def inferred_poster_path(video_path)
  video_path.sub(/\.mp4\z/i, "-poster.jpg")
end

def generate_poster(video_abs_path, poster_abs_path)
  FileUtils.mkdir_p(File.dirname(poster_abs_path))
  command = [
    "ffmpeg",
    "-y",
    "-ss",
    TIMESTAMP,
    "-i",
    video_abs_path,
    "-frames:v",
    "1",
    poster_abs_path
  ]

  stdout, stderr, status = Open3.capture3(*command)
  return if status.success?

  abort <<~MSG
    Failed to generate poster for #{video_abs_path}
    Command: #{command.join(' ')}
    #{stdout}
    #{stderr}
  MSG
end

def optimize_video_for_web(video_abs_path)
  temp_output = "#{video_abs_path}.faststart.tmp.mp4"
  command = [
    "ffmpeg",
    "-y",
    "-i",
    video_abs_path,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-level:v",
    "4.1",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    temp_output
  ]

  stdout, stderr, status = Open3.capture3(*command)
  return if status.success? && File.exist?(temp_output)

  FileUtils.rm_f(temp_output)
  abort <<~MSG
    Failed to optimize video for web playback: #{video_abs_path}
    Command: #{command.join(' ')}
    #{stdout}
    #{stderr}
  MSG
end

unless system("ffmpeg", "-version", out: File::NULL, err: File::NULL)
  abort "ffmpeg is required to generate gallery posters."
end

generated = 0
checked = 0

Dir.glob(File.join(GALLERIES_DIR, "*.markdown")).sort.each do |gallery_path|
  front_matter = parse_front_matter(gallery_path)
  photos = front_matter["photos"] || []

  photos.each do |item|
    next unless item.is_a?(Hash) && item["video"]

    checked += 1
    video_path = item["video"]
    unless video_path.downcase.end_with?(".mp4")
      abort "Only MP4 gallery videos are supported: #{video_path} in #{gallery_path}"
    end

    video_abs_path = resolve_site_path(video_path)
    abort "Missing gallery video file: #{video_path} in #{gallery_path}" unless File.exist?(video_abs_path)

    optimize_video_for_web(video_abs_path)
    FileUtils.mv("#{video_abs_path}.faststart.tmp.mp4", video_abs_path, force: true)

    if item["poster"]
      poster_abs_path = resolve_site_path(item["poster"])
      abort "Explicit poster file is missing: #{item['poster']} in #{gallery_path}" unless File.exist?(poster_abs_path)
      next
    end

    poster_path = inferred_poster_path(video_path)
    poster_abs_path = resolve_site_path(poster_path)
    next if File.exist?(poster_abs_path)

    generate_poster(video_abs_path, poster_abs_path)
    generated += 1
    puts "Generated poster: #{poster_path}"
  end
end

puts "Checked #{checked} gallery video item(s); generated #{generated} poster(s)."
