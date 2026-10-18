# 059 — Google photos: faster, and on listing cards (SoiGuru)

Status: implemented

## Problem

Google Places photos (spec 056) showed only on listing pages and took about 1.5 to 2 seconds:
the photo list (~0.8 s, a place search on every cold start because place IDs lived only in
memory), then the images. Cards on the city home ("Open now"), nearby and similar places kept
their drawings.

Google's terms do not allow storing Places photos or photo names; place IDs may be stored. So
the photos stay live, and the work is to make each live call cheaper and earlier.

## Behaviour

- **Stored place IDs.** A listing may carry `google_place_id` in the content repo; the lookup
  uses it and skips the Text Search. `GET /api/places/photos/{slug}` now also returns
  `placeId`, so the IDs can be written back to the content (a one-off script, data branch).
- **Card photos.** `GET /api/places/cards?slugs=a,b,c` (max 12) returns the first photo per
  listing, looked up in parallel: `{ photos: { [slug]: { url, width, height, author, authorUri } | null } }`.
  CORS for the public site; `Cache-Control: public, max-age=300`.
- **Daily budget.** Every Google call (search, details, photo media) counts against
  `PLACES_DAILY_LIMIT` (default 4000 per UTC day, per server process). Over it the routes return
  no photos and the site keeps its drawings.
- `lib/soiguru/places-http.ts` now holds the shared CORS and public-origin helpers of both routes.

## Public site side

`astro/` (branch `claude/soiguru-astro-cloudflare-deploy-18er0p`): the listing page preloads
the photo list in `<head>`, shows a quiet placeholder grid and fades the photos in (800px big,
480px small); cards without a photo ask for theirs once they scroll near the screen
(`scripts/soiguru/places-cards.ts`), 480px wide, with "Photo: <author> on Google".

## Cost note

Each card view costs a Place Details call and a photo media call (fewer once place IDs are
stored). The 5-minute browser cache and the daily budget bound the bill.
