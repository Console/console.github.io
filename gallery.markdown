---
layout: page
title: Gallery
permalink: /gallery/
---

A collection of photographs i've taken through the years. I dabble in astrophotography and normal photography. Most of these will be taken with my Fujifilm X100F camera, I find the camera itself pretty useful for most photographic tasks, it's wide angle lens basically being 35mm equivalent and the 24 megapixel captures are enough that some cropping is usually enough to get in closer to further away targets.

For those targets that happen to be several light years away though - I typically use either my DWARF3 Smart telescope, my William Optics RedCat51 Refractor or my SVBony MK127 Maksutov-cassegrain scope, coupled with a number of ZWO cameras from the ASIAir 585MC, a 585MC Pro, or a 715MC planetary camera or for guiding an ASI 129MM mini. I'll use tags in the galleries below to tag what equipment I used with which.

These images are not the final high resolution images, due to size constraints and not forcing folk to download 100MB+ images, I've saved them as 8bit JPG at 80% quality. If you'd like any of the images for any reason please give me a shout via my socials.

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
              {%- assign tag_slug = tag | append: "" | slugify -%}
              <li><a href="{{ '/gallery/tags/' | relative_url }}#tag-{{ tag_slug }}">{{ tag }}</a></li>
            {%- endfor -%}
          </ul>
        {%- endif -%}
      </div>
    </article>
  {%- endfor -%}
</div>
