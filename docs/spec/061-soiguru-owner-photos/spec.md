# 061 — Owners add their own photos (SoiGuru)

Status: implemented

## Problem

Listings without photos show Google photos (specs 056, 059, 060). Google's terms do not allow
SoiGuru to download or keep those photos, and every photo counts against the free monthly usage.
Owners who claim their listing should be able to show their own photos instead.

## Behaviour

- The owner dashboard has a Photos row (`/owner/<city>/<slug>/photos`) with the count, and a
  nudge to add photos once hours, Thai name, LINE and amenities are filled in.
- The photos screen lists the listing's photos. The first one is marked "First photo" and is the
  big photo on the listing and the card photo. Every other photo has "Make first"; every photo
  has "Remove".
- "Add photos" takes up to eight in total. The browser shrinks each photo to at most 1600 px
  (WebP, else JPEG) before upload, so phones upload fast and the content repo stays small.
- `POST /api/soiguru/owner/photos` (multipart: `city`, `listing`, `photo` files) checks the
  origin and edit access, checks the file type by its first bytes (JPEG, PNG, WebP) and size
  (3 MB after shrinking), writes `data/<slug>/photos/<random>.<ext>` in the content repo and
  appends `https://soiguru.com/media/<slug>/<file>` to the listing's `images`. Written files are
  removed again when saving the listing fails. Errors: `signed-out`, `denied`, `too-many`,
  `not-an-image`, `too-large`, `failed`.
- `GET /api/soiguru/media/<slug>/<file>` serves a stored photo with a one-year immutable cache.
  On soiguru.com the Worker serves `/media/*` from the edge cache and fetches it from the owner
  app on a miss.
- Removing a photo removes the file and the URL; "Make first" moves the URL to the front.
- Once a listing has photos, the site no longer asks Google for its photos.

## Not covered

soiguru.com is a static build: new photos appear there after the next site deploy. Photo
moderation is the admin's job through the normal listing edit.
