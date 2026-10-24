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

## Addendum — 2026-10-24: the pipeline code lands

The first change for this spec shipped only the `sharp` dependency and this text; `writePhoto`
kept storing the uploaded bytes unchanged. Owner uploads ended up as one `<id>.webp` without
copies, and soiguru.com's cards and thumbnails asked for `<id>-800.webp` / `<id>-400.webp`
and got a 404 (a broken image on every list card of that listing).

- `lib/soiguru/photo-sizes.ts` encodes the three files (main at most 1600px, quality 80; copies
  800×600 and 400×300, cover with attention framing, EXIF rotation applied).
- `writePhoto` (owner uploads and approved claim photos) writes all three; an input sharp
  cannot decode is `not-an-image`. `deletePhotoFile` removes the copies with the main file.
- `readPhoto` (the media route) serves `-800`/`-400` names. For a WebP uploaded before this
  fix it makes the copy from the main file on request instead of answering 404; the copy is
  not written to the content repo (it changes only through commits) and the edge caches it.
- Photos stored as JPEG or PNG keep working as before: the site uses their main URL.
