---
layout: page
title: Gallery
permalink: /gallery/
---

A collection of photo albums and image sets.

<div class="gallery-album-list">
  {%- assign galleries = site.galleries | sort: "title" -%}
  {%- for gallery in galleries -%}
    <article class="gallery-album-card">
      {%- assign cover = gallery.cover | default: gallery.photos.first.image -%}
      {%- if cover -%}
        <a href="{{ gallery.url | relative_url }}" class="gallery-album-cover">
          <img src="{{ cover | relative_url }}" alt="{{ gallery.title | escape }}">
        </a>
      {%- endif -%}
      <div class="gallery-album-summary">
        <h2><a href="{{ gallery.url | relative_url }}">{{ gallery.title | escape }}</a></h2>
        {%- if gallery.description -%}
          <p>{{ gallery.description | escape }}</p>
        {%- endif -%}
        {%- if gallery.tags -%}
          <ul class="gallery-tag-list" aria-label="Gallery tags">
            {%- for tag in gallery.tags -%}
              <li>{{ tag }}</li>
            {%- endfor -%}
          </ul>
        {%- endif -%}
      </div>
    </article>
  {%- endfor -%}
</div>
