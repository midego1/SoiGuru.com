# 067 — Photo pipeline: WebP, sizes, thumbnails (SoiGuru)

Status: implemented

## Problem

Owner photos (specs 061, 064) were stored as the browser sent them: one file, one size. Cards
and thumbnails loaded the full image, and a phone that could not encode WebP sent JPEG.

## Behaviour

- Every accepted photo is re-encoded on the server with sharp: EXIF rotation applied, then
  three WebP files written next to the listing (`data/<slug>/photos/`):
  - `<id>.webp`: at most 1600 px on the long side, quality 80 (the listing's big photo);
  - `<id>-800.webp`: 800×600, cropped to cover with attention-based framing (cards, the small
    grid);
  - `<id>-400.webp`: 400×300 (thumbnails).
- The listing's `images` keeps only the main URL; the site derives the copies from it
  (`photoVariant(url, 800 | 400)` in `lib/soiguru/media.ts`). Removing a photo removes all
  three files. Claim photos (spec 064) go through the same writer on approval.
- The media route and the soiguru.com Worker accept the `-800`/`-400` names.
- Input is still checked by file signature (JPEG, PNG, WebP) and size (3 MB after the
  browser's shrink); a file sharp cannot decode is refused as `not-an-image`.
- `sharp` is now a direct dependency of the web app (it was already present through Next.js).

## Not covered

Older photos uploaded before this spec have no copies; the site falls back to the main file
for them. AVIF is not produced; WebP is enough for the sizes involved.
