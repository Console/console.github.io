# blog.scriptmonkey.uk

Jekyll-based static site for `https://blog.scriptmonkey.uk`, published with GitHub Pages.

The site contains blog posts, static pages, AI game pages, CTF content, and a Markdown-editable gallery collection.

## Site Structure

- `_posts/` - Blog posts.
- `_galleries/` - Gallery album pages.
- `_layouts/` - Page, post, and gallery layouts.
- `_includes/` - Shared HTML snippets.
- `_sass/minima/` - Site styles.
- `assets/images/` - Existing blog and shared images.
- `assets/gallery/` - Gallery album images.
- `gallery.markdown` - Gallery landing page.
- `blog.markdown` - Blog listing page.
- `.github/workflows/jekyll.yml` - GitHub Pages build and deploy workflow.

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
eval "$(rbenv init - bash)" && bundle exec jekyll build
```

The generated site is written to `_site/`.

## Preview Locally

```bash
eval "$(rbenv init - bash)" && bundle exec jekyll serve
```

Then open:

```text
http://127.0.0.1:4000/
```

For WSL, if the browser cannot reach the site, run:

```bash
eval "$(rbenv init - bash)" && bundle exec jekyll serve --host 0.0.0.0
```

If file watching is unreliable under WSL:

```bash
eval "$(rbenv init - bash)" && bundle exec jekyll serve --no-watch
```

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
---
```

The body of the Markdown file can contain normal album intro text.

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
