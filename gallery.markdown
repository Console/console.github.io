---
layout: page
title: Gallery
permalink: /gallery/
kicker: Photography
show-page-header: false
---

<div class="page-intro page-intro-gallery">
  <span class="page-header-kicker">Photography</span>
  <h1 class="post-title">Gallery</h1>
  <p class="page-intro-lead">A collection of photographs I've taken through the years, from days out with the Fujifilm X100F to more patient astrophotography sessions.</p>

  <div class="page-intro-body">
    <p>I dabble in astrophotography and normal photography. Most of these will be taken with my Fujifilm X100F camera, I find the camera itself pretty useful for most photographic tasks, it's wide angle lens basically being 35mm equivalent and the 24 megapixel captures are enough that some cropping is usually enough to get in closer to further away targets.</p>

    <p>For those targets that happen to be several light years away though - I typically use either my DWARF3 Smart telescope, my William Optics RedCat51 Refractor or my SVBony MK127 Maksutov-cassegrain scope, coupled with a number of ZWO cameras from the ASIAir 585MC, a 585MC Pro, or a 715MC planetary camera or for guiding an ASI 129MM mini. I'll use tags in the galleries below to tag what equipment I used with which.</p>

    <p>These images are not the final high resolution images, due to size constraints and not forcing folk to download 100MB+ images, I've saved them as compressed jpgs or pngs. If you'd like any of the images for any reason please give me a shout via my socials.</p>
  </div>

  <div class="page-intro-actions">
    <a class="page-intro-link" href="{{ '/gallery/tags/' | relative_url }}">Browse by tag</a>
  </div>
</div>

<section class="listing-section">
  <div class="listing-section-heading">
    <span class="listing-section-kicker">Recent Albums</span>
    <h2>Gallery Collection</h2>
    <a href="{{ '/gallery/tags/' | relative_url }}">View tags</a>
  </div>

<div class="gallery-album-list">
  {%- assign galleries = site.galleries | sort: "date" | reverse -%}
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
        <p class="gallery-album-date">{{ gallery.date | date: "%Y/%m/%d" }}</p>
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
</section>
