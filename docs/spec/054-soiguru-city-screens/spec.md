---
id: spec-054-soiguru-city-screens
title: Spec 054 — SoiGuru city screens
sidebar_label: 054 SoiGuru city screens
---

# Feature spec — `054-soiguru-city-screens`

## 1. Summary

SoiGuru is a multi-city local business directory for Thailand (Krabi, Chiang
Mai, Lam Plai Mat) built on this template. This spec adds its first four public
screens, ported from the "TheKrabiGuide" Claude Design system (renamed SoiGuru):

| Route | Screen |
| --- | --- |
| `/` (and `/cities`) | City landing: the list of cities with listing counts |
| `/<city>` | CityHome: search, category tiles, open now in the default area, areas, owner call-to-action |
| `/<city>/<category>`, `/<city>/<area>`, `/<city>/search?q=` | CategoryResults: list + OpenStreetMap map, filters in the URL |
| `/<city>/<area>/<slug>` | ListingPage: status, contact bar, hours, amenities, map, claim box, nearby, LocalBusiness JSON-LD |

Every route also exists under `/th/…` (the EN/TH language toggle).

## 2. Motivation

The template's item pages are built for software directories. A local directory
answers different questions: is it open now, how far is it, how do I reach it
(phone, LINE, WhatsApp, directions). The design system specifies those screens
for a phone held in one hand; this spec implements them on the server so they
paint before any script runs.

## 3. Decisions

- **Multi-city, option B**: one app, one database, shared accounts. The city is
  the first path segment; cities and their areas come from `cities.yml` in the
  content repository (`lib/soiguru/content.ts` falls back to the three launch
  cities when the file is missing).
- **Brand**: the top bar shows a fixed "SoiGuru" wordmark with the city as a
  separate label ("SoiGuru · Krabi").
- **Data**: listings are ordinary content items with the soiguru-data keys
  (`city`, `area`, `name_th`, `geo`, `hours`, `phone`, `line_id`, `whatsapp`,
  `price_band`, `rating`, `rating_count`, `claimed`, `amenities`,
  `description_th`, `booking_note`, `hours_note`, `updated_by`, `sample`).
  `parseItem` keeps unknown keys, so no change to `lib/content.ts` is needed;
  `lib/soiguru/content.ts` maps an item to a typed `Listing`.
- **Open status** is computed at render time in `Asia/Bangkok`, never stored
  (`lib/soiguru/hours.ts`). Pages revalidate every 60 s; results are dynamic.
  Unclaimed listings older than 90 days show "Hours not confirmed".
- **No client script on these screens.** Filters, sort, area, list/map mode and
  the selected map pin are query-string links; the area and sort pickers are
  `<details>` menus.
- **Maps**: OpenStreetMap raster tiles laid out as `<img>` elements by a server
  component (`components/soiguru/tile-map.tsx`), with no map library and no new
  dependency. The tile URL is `NEXT_PUBLIC_MAP_TILE_URL` (default
  `tile.openstreetmap.org`, acceptable for development only under the OSM tile
  usage policy). Apple MapKit is a later option.
- **Styling**: the design's `bundle.css` and `tokens.json` are ported to
  `app/[locale]/(soiguru)/soiguru.css`, scoped under `.tkg-root` so nothing
  leaks into template pages. Dark theme follows `prefers-color-scheme`.
  Fonts: IBM Plex Sans + IBM Plex Sans Thai via `next/font/google`.
- **Template chrome**: `ConditionalLayout` hides the template header and footer
  for the site root and for paths whose first segment is a city id.
- **UI strings** live in the `soiguru` namespace of `messages/en.json` and
  `messages/th.json`; other locales fall back to English through the existing
  deep merge.
- The site root (`/`) now rewrites to the city landing; the template's item
  listing stays reachable at `/discover`.
- **Desktop layout** (from 1024px). The design only specifies the 640px phone
  column, so the app extends it: a 1152px content column with the top bar and
  hero bands spanning the window, the tab bar's destinations as top-bar links
  (the bottom tab bar is hidden), 8 category tiles and 3 listing cards per row
  on CityHome, city cards on the landing, and on ListingPage the details on
  the left with contact, hours and map in a sticky 360px right rail.
  CategoryResults keeps its docked map.

## 4. Non-goals (later specs)

- ClaimFlow and OwnerDashboard (need auth, payments and the database).
- Visitor geolocation ("Near me", distances from the visitor). Distances are
  measured from the area centre for now.
- The Filters sheet (price band, rating, has LINE, verified only), map panning
  with "Search this area", Save and Share on the listing page, the
  "Report wrong info" form (it links to `SOIGURU_REPORT_EMAIL` or `/help`).
- Admin editing of listings: `lib/services/item-git.service.ts` writes items
  through a field whitelist and would drop the SoiGuru keys on any admin edit.
  This must be fixed before admins or owners edit listings.

## 5. Acceptance

- `/krabi`, `/krabi/nail-salons`, `/krabi/ao-nang/krabi-nail`, `/th/krabi` and
  `/` render with the soiguru-data sample content; an unknown city or segment
  returns 404.
- The listing page carries a `NailSalon` (category `schema_type`, default
  `LocalBusiness`) JSON-LD block with address, geo, telephone,
  `openingHoursSpecification` and `aggregateRating`; sample listings are
  `noindex`.
- `pnpm tsc --noEmit`, `pnpm lint` and `next build` pass.
