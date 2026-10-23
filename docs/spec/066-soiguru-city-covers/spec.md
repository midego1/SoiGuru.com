# 066 — City cover photos (SoiGuru)

Status: implemented

## Problem

The landing page's city cards and the city page hero showed a drawn karst scene. A real photo
of the place sells the city better, and the owner picked one on Unsplash.

## Behaviour

- `cities.yml` may carry a `cover` per city: `url` (about 1600×900), `thumb` (about 640×360),
  `author`, `author_url`, `photo_url`, `photo_id`. The site reads it into `City.cover`.
- Landing page: a city with a cover shows the thumb across the top of its card (with a soft
  gradient under the name) instead of the drawn hills; the photographer is in the image title.
- City page: the hero art is the cover (16:9, rounded) with a credit line "Photo: <name> /
  Unsplash" linking to the photographer and the photo with `utm_source=soiguru`, as Unsplash's
  guidelines ask. Cities without a cover keep the drawing.
- `scripts/city-covers.ts` (run by the manual GitHub workflow **City cover photos**) fills
  `cover` from Unsplash: search "<city> Thailand", landscape, first result, or a pinned photo
  id (`--city krabi --photo <id>`), registers the download with Unsplash, and commits
  `cities.yml` to the `data` branch and then starts the publish workflow itself (a push made
  with the workflow's own token never triggers other workflows), so the site republishes
  (spec 062). Covers that exist
  are kept unless `force` is ticked. The Unsplash Access Key lives only in the GitHub secret
  `UNSPLASH_ACCESS_KEY`; the site build never calls Unsplash, so every deploy shows the same photo.
- Images are hotlinked from Unsplash's CDN with size and quality parameters (never re-hosted),
  as their terms require.

## Not covered

A cover uploaded by hand (not from Unsplash) works with the same fields pointing at a file in
`public/`; no tool for that yet.
