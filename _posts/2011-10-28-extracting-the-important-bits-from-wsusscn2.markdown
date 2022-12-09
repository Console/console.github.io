---
layout: post
title:  "NFTF: Extracting the important bits from wsusscn2.cab"
date:   2011-10-28 00:00:00 +0000
categories: blog

---
Working on a script for extracting MS numbers for patches as part of my work. Just wanted to make a note of a quick one liner

```shell
"c:\Program Files\7-Zip\7z.exe" x -ir!x/*cabs/package*.cab
```

Blimmin' handy.