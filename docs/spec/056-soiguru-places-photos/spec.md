# 056 — Google Places photos for SoiGuru listings

## Why

Most listings have no photos yet. Until owners claim their listing and upload their own, the public site (soiguru.com) shows Google Places photos as a fallback.

## What

- `GET /api/places/photos/{slug}`: up to three photos of a listing in the content repository, `{ photos: [{ url, width, height, author, authorUri }] }`. Only known listings are looked up, so the key cannot be spent on arbitrary places. CORS for `PUBLIC_SITE_ORIGINS` (default `https://soiguru.com,https://www.soiguru.com`).
- `GET /api/places/photo?name=…&sig=…&w=…`: 302 to Google's short-lived photo URL. `sig` is an HMAC (AUTH_SECRET) of the photo name, so only photos this server listed are served.
- Matching: Text Search (New) with the listing's name, area and city, biased to its coordinates; the first result within 400 m is taken (any first result when the listing has no coordinates). The place ID is kept in memory; photos and photo names are not stored (Google Maps Platform terms).
- The public site shows the photos only when a listing has none of its own, with the author credit ("Photo: … on Google").
- Off when `GOOGLE_PLACES_API_KEY` is unset (empty list).

## Cost

Per listing page view: one Place Details (photos field) and one Place Photo per photo shown; one Text Search per listing per server start.

## Files

- `apps/web/lib/services/google-places.service.ts`
- `apps/web/app/api/places/photos/[slug]/route.ts`
- `apps/web/app/api/places/photo/route.ts`
