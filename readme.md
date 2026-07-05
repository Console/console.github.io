# blog.scriptmonkey.uk

Jekyll-based static site for `https://blog.scriptmonkey.uk`, published with GitHub Pages.

The site contains blog posts, static pages, AI game pages, CTF content, and a Markdown-editable gallery collection.

## Site Structure

- `_posts/` - Blog posts.
- `_galleries/` - Gallery album pages.
- `_layouts/` - Page, post, and gallery layouts.
- `_includes/` - Shared HTML snippets.
- `_sass/minima/` - Site styles.
- `_includes/header.html` - Curated primary navigation and mobile menu markup.
- `assets/images/` - Existing blog and shared images.
- `assets/gallery/` - Gallery album images.
- `index.markdown` + `_layouts/home.html` - Homepage content and landing-page layout.
- `gallery.markdown` - Gallery landing page.
- `gallery-tags.markdown` - Gallery tag landing page.
- `blog.markdown` - Blog listing page.
- `.github/workflows/jekyll.yml` - GitHub Pages build and deploy workflow.

## Navigation

The primary header navigation is manually curated in:

```text
_includes/header.html
```

It is no longer generated automatically from all titled pages.

Current top-level structure:

1. `Gallery`
2. `Blog`
3. `Projects & Talks`
4. `About`

Current child links:

1. `Gallery`
   - `Browse Gallery`
   - `Gallery Tags`
2. `Projects & Talks`
   - `AI-Games`

Active states are also handled in `_includes/header.html` by checking `page.url` and setting booleans for each top-level section.

### Add A New Top-Level Link

Edit `_includes/header.html` and add another `li.site-nav-item` inside:

```html
<ul class="site-nav-list">
```

Example:

```html
<li class="site-nav-item{% if new_section_active %} is-active{% endif %}">
  <a class="page-link" href="{{ '/new-section/' | relative_url }}">New Section</a>
</li>
```

If the new section needs an active state, also add a boolean near the top of the file alongside `gallery_active`, `blog_active`, and the others.

Example:

```liquid
{%- assign new_section_active = false -%}
{%- if current_url == '/new-section/' or current_url contains '/new-section/' -%}
  {%- assign new_section_active = true -%}
{%- endif -%}
```

### Add A Child Link Under An Existing Section

Child links live inside the nested:

```html
<ul class="site-subnav-list">
```

Example under `Gallery`:

```html
<ul class="site-subnav-list">
  <li><a class="page-link site-subnav-link" href="{{ '/gallery/' | relative_url }}">Browse Gallery</a></li>
  <li><a class="page-link site-subnav-link" href="{{ '/gallery/tags/' | relative_url }}">Gallery Tags</a></li>
  <li><a class="page-link site-subnav-link" href="{{ '/gallery/favourites/' | relative_url }}">Favourites</a></li>
</ul>
```

### Add A New Parent Section With Children

Use the `site-nav-item-parent` class on the top-level `li` and add a nested `site-subnav-list`.

Example:

```html
<li class="site-nav-item site-nav-item-parent{% if notes_active %} is-active{% endif %}">
  <a class="page-link" href="{{ '/notes/' | relative_url }}">Notes</a>
  <ul class="site-subnav-list">
    <li><a class="page-link site-subnav-link" href="{{ '/notes/' | relative_url }}">All Notes</a></li>
    <li><a class="page-link site-subnav-link" href="{{ '/notes/archive/' | relative_url }}">Archive</a></li>
  </ul>
</li>
```

Desktop behavior uses hover/focus dropdowns. Mobile behavior shows child links inline inside the opened menu panel.

## Homepage

The homepage uses a custom landing-page layout in:

```text
_layouts/home.html
```

It is intentionally curated rather than showing the full latest blog post.

Current homepage sections:

1. `Field Notes` intro panel
2. `Latest Additions`
   - latest gallery by gallery `date`
   - latest blog post by post date
3. `Recent Gallery`
4. `Recent Writing`

The homepage relies on gallery items having a `date:` field in front matter so the latest gallery can be determined reliably.

## Local Requirements

The site is built with Ruby, Bundler, Jekyll, and the `github-pages` gem.

Recommended local Ruby version:

```bash
ruby 3.1.x
```

This repo has been validated locally with `rbenv` and Ruby `3.1.2`.

## Local Setup

From the repository root:

```bash
eval "$(rbenv init - bash)"
bundle install
```

If using WSL or a shell that does not load `rbenv` automatically, include this before Bundler/Jekyll commands:

```bash
eval "$(rbenv init - bash)"
```

## Build The Site

```bash
eval "$(rbenv init - bash)" && ruby scripts/generate_gallery_posters.rb && bundle exec jekyll build
```

The generated site is written to `_site/`.

## Preview Locally

```bash
eval "$(rbenv init - bash)" && ruby scripts/generate_gallery_posters.rb && bundle exec jekyll serve
```

Then open:

```text
http://127.0.0.1:4000/
```

For WSL, if the browser cannot reach the site, run:

```bash
eval "$(rbenv init - bash)" && ruby scripts/generate_gallery_posters.rb && bundle exec jekyll serve --host 0.0.0.0
```

If file watching is unreliable under WSL:

```bash
eval "$(rbenv init - bash)" && ruby scripts/generate_gallery_posters.rb && bundle exec jekyll serve --no-watch
```

The poster-generation step requires `ffmpeg` to be available locally.

## Blog Posts

Blog posts live in `_posts/`.

Filename format:

```text
YYYY-MM-DD-title.markdown
```

Typical front matter:

```yaml
---
layout: post
title: "Post Title"
date: 2026-01-01 12:00:00 +0000
categories: blog
image: /assets/images/example.png
---
```

The blog listing uses Jekyll excerpts. Excerpts are configured in `_config.yml` to use the first paragraph:

```yaml
excerpt_separator: "\n\n"
```

This preserves markdown links in summaries.

## Gallery Albums

Gallery albums live in `_galleries/`.

Each album is a Markdown file with front matter defining the album and its photos.

Recommended pairing:

```text
_galleries/conference-2026.markdown
assets/gallery/conference-2026/
```

Gallery images should be uploaded under `assets/gallery/<album-name>/`, for example:

```text
assets/gallery/
  conference-2026/
    stage.jpg
    audience.jpg
  travel/
    berlin-01.jpg
    berlin-02.jpg
```

Example album front matter:

```yaml
---
layout: gallery
title: Conference 2026
date: 2026-06-01 12:00:00 +0000
description: A short description of the album.
cover: /assets/gallery/conference-2026/stage.jpg
tags:
  - conference
  - talks
photos:
  - image: /assets/gallery/conference-2026/stage.jpg
    caption: Presenting on stage.
    alt: Speaker presenting on stage
    tags:
      - stage
      - conference
  - video: /assets/gallery/conference-2026/walkthrough.mp4
    poster: /assets/gallery/conference-2026/walkthrough-poster.jpg
    caption: A short walkthrough clip.
    alt: Short walkthrough video
    tags:
      - conference
      - video
---
```

The body of the Markdown file can contain normal album intro text.

`date:` is used by the homepage and the gallery landing page for reverse-chronological ordering.

Gallery entries can now contain either images or MP4 videos:

1. Image item:

```yaml
- image: /assets/gallery/conference-2026/stage.jpg
  caption: Presenting on stage.
```

2. Video item:

```yaml
- video: /assets/gallery/conference-2026/walkthrough.mp4
  caption: A short walkthrough clip.
```

Video notes:

1. Use `video:` for the MP4 file.
2. `poster:` is optional. If omitted, the build script generates `*-poster.jpg` next to the video.
3. If `poster:` is supplied explicitly, that file must exist and will be used as-is.
4. The templates fall back to `image:` if you set one, otherwise to the inferred `*-poster.jpg` path.
5. The build helper also transcodes gallery MP4s to a browser-safe H.264/AAC MP4 with `faststart` for more reliable playback.
6. If a poster is temporarily missing during local preview, gallery grids fall back to an inline muted video preview instead of a broken image.
7. Video items render as playable MP4s in the gallery viewer and on the gallery tags page.
8. AVI is not supported by the gallery templates; convert source videos to MP4 before uploading.

Automatic poster generation example:

```text
/assets/gallery/conference-2026/walkthrough.mp4
-> /assets/gallery/conference-2026/walkthrough-poster.jpg
```

Album URLs are generated from `_config.yml`:

```yaml
collections:
  galleries:
    output: true
    permalink: /gallery/:name/
```

The gallery landing page is:

```text
/gallery/
```

Individual albums are published at:

```text
/gallery/album-file-name/
```

Clicking a gallery thumbnail opens an in-page photo viewer at a fragment URL such as:

```text
/gallery/album-file-name/#photo-1
```

The viewer includes previous and next links, a close link back to the thumbnail grid, captions, tags, and a direct link to open the original image file.

Album and photo tags link to the generated tag gallery page:

```text
/gallery/tags/#tag-wildlife
```

Each tag section lists matching albums and photos with that tag. Photo-level tags include only explicitly tagged photos; album-level tags include every photo from matching albums. The tag page hides result sections until a tag fragment is selected, such as `/gallery/tags/#tag-wildlife`. Opening a photo from a tag section uses a tag-specific viewer, so previous and next navigation stays within that tag result set rather than returning to the source album.

## Styling

Main Sass entry point:

```text
_sass/minima.scss
```

Gallery-specific styles:

```text
_sass/minima/_gallery.scss
```

Feed/blog-card styles:

```text
_sass/minima/_feed.scss
```

Layout and header styles:

```text
_sass/minima/_layout.scss
```

Current styling split:

1. `_layout.scss`
   - header and navigation
   - page wrapper and article/post layout
   - single-post reading layout
2. `_feed.scss`
   - homepage layout
   - page intro panels
   - blog listing cards
3. `_gallery.scss`
   - gallery landing page
   - individual gallery pages
   - gallery tag page
   - gallery viewer and shared gallery tile styling

## Deployment

Deployment is handled by GitHub Actions:

```text
.github/workflows/jekyll.yml
```

The workflow:

1. Checks out the repository.
2. Sets up Ruby.
3. Runs `bundle exec jekyll build`.
4. Packages `_site` into `artifact.tar`.
5. Uploads the artifact as `github-pages`.
6. Deploys with `actions/deploy-pages`.

The workflow runs on pushes to `main` and can also be triggered manually from GitHub Actions.

## Common Issues

### `bundle: command not found`

Make sure `rbenv` is initialised:

```bash
eval "$(rbenv init - bash)"
```

Then retry:

```bash
bundle install
```

### Permission errors installing gems

Do not use `sudo bundle install`.

Use `rbenv`, then check Ruby paths:

```bash
which ruby
which gem
which bundle
```

They should point to `~/.rbenv/shims/...`.

### `cannot load such file -- webrick`

`webrick` is required for `jekyll serve` on newer Ruby versions and is included in the `Gemfile`:

```ruby
gem "webrick", "~> 1.8"
```

Run:

```bash
bundle install
```

### Faraday retry warning

You may see:

```text
To use retry middleware with Faraday v2.0+, install `faraday-retry` gem
```

This comes from the GitHub Pages dependency stack and does not currently block local builds or deployment.
