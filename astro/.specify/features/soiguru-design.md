# Feature: SoiGuru design port (CityHome, CategoryResults, ListingPage, landing)

**Status**: first pass implemented (branch `design/soiguru`)
**App**: `apps/web` (`@ever-works/web-minimal`), static build (`ENABLE_ISR=false`), deployed to Cloudflare Pages project `soiguru-minimal`
**Design source**: Claude Design System artifact "TheKrabiGuide" (renamed SoiGuru): `README.md`, `tokens.json`, `components/bundle.css`, `components/bundle.js`, per-component READMEs and previews
**Data**: `midego1/soiguru-data` (Ever Works format plus SoiGuru fields; schema in that repo's `README.md`)

## Goal

SoiGuru is a multi-city local business directory for Thailand (Krabi, Chiang Mai, Lam Plai Mat). This template is built in parallel with the Next.js app (`midego1/SoiGuru.com`) for an A/B comparison, so the markup keeps the design's `tkg-` classes 1:1 and the same URLs.

## Routes

| URL                     | Screen                                               | File                                   |
| ----------------------- | ---------------------------------------------------- | -------------------------------------- |
| `/`                     | Landing: the cities                                  | `src/pages/index.astro`                |
| `/<city>`               | CityHome                                             | `src/pages/[city]/index.astro`         |
| `/<city>/<category>`    | CategoryResults for a category                       | `src/pages/[city]/[segment].astro`     |
| `/<city>/<area>`        | CategoryResults for an area (all categories)         | `src/pages/[city]/[segment].astro`     |
| `/<city>/search?q=`     | CategoryResults for a search (noindex)               | `src/pages/[city]/search.astro`        |
| `/<city>/<area>/<slug>` | ListingPage with `LocalBusiness` JSON-LD             | `src/pages/[city]/[area]/[slug].astro` |
| `/directory`            | The template's generic item listing (moved from `/`) | `src/pages/directory.astro`            |

Category and area ids share the second URL segment; `soiguru-data` keeps them distinct (an area id equal to a category id is skipped).

## Data contract

- `cities.yml` (cities with `areas`, `timezone`, `default_area`, `geo`) and `amenities.yml` (id → EN/TH label) are SoiGuru extensions read through `readContentYaml()` in `src/lib/content.ts`.
- Items keep every extra YAML key (core item loader spreads the raw YAML). `src/lib/soiguru/data.ts` narrows them into a typed `Listing`: `city`, `area`, `name_th`, `description_th`, `address`, `geo`, `phone`, `line_id`, `whatsapp`, `hours`, `hours_note`, `booking_note`, `price_band`, `rating`, `rating_count`, `claimed`, `amenities`, `updated_by`, `updated_at`, `sample`.
- Categories: the core category loader now passes extra keys through (`name_th`, `short_name`, `icon`), re-validating its known keys. Higher `priority` sorts first (as in `soiguru-data` and the Next.js template).
- `works.yml`: optional `claim_url` (Claim buttons; `{city}` is replaced by the city id; hidden without it), `owner_url` (Owner tab and "For owners"; falls back to the city's `claim_url`) and `contact_email` ("Report wrong info"; hidden without it).

## Behaviour

- **Open status** is computed in the browser from `hours` and the city time zone (`Intl`, Asia/Bangkok), because static HTML cannot know the visitor's time. States and sentences follow the OpenStatus README, in EN and TH. "Open now" lists count only places a visitor can walk into now (not "Opens at").
- Unclaimed listings with hours older than 90 days show "Hours not confirmed".
- **Hours table**: Monday first with identical consecutive days merged; the browser marks today's row.
- **Distances** appear when location permission is already granted, or after "Near me" / sort "Nearest".
- **Results filters** (open now, area, sort, search text, List/Map) run in the browser over the rendered cards and are kept in the URL. "Open now" is on by default 09:00–23:00 local time. Closed places sit behind "Show N closed now"; "Show more" at 20.
- **Map**: Leaflet with OpenStreetMap tiles, imported on demand on results pages only. The listing page uses static OSM tile images (no library).
- **Language**: EN / ไทย toggle remembered on the device; swaps every `[data-th]` text and the status sentences.
- **Structured data**: `LocalBusiness` subtype per category with `openingHoursSpecification`, `geo`, `address`, `priceRange`, `aggregateRating`, `amenityFeature`; `BreadcrumbList` on city, results and listing pages.

## Desktop layout (960px and up)

The design is phone first: one 640px column, and only CategoryResults has a wide version (list 420px on the left, map filling the rest). Desktop visitors saw a phone column in the middle of the screen, so every screen now extends to desktop in the same style:

- Top bar spans the window; its content sits in a 1200px column. Home / Search / For owners links (`TopNav`) replace the bottom tabs, which are hidden. Back-mode bars also show the SoiGuru wordmark.
- Landing and CityHome: the header becomes a bordered card with a 40px display title, categories sit in one row of 8, the "Open now" list is a 3-column grid showing 6 (`data-limit-wide`), area chips wrap, cities are a 3-column grid.
- ListingPage: two columns. Left: photos, title, good to know (3 columns), about, nearby, report. Right: a sticky card with the contact buttons, hours, map and claim box. The sticky Directions bar is hidden (Directions is in the contact card). On phones the page keeps its single column in the original order through CSS `order`.
- CategoryResults and search keep the design's wide layout.

## Full public site (second pass)

- **Search** runs in the browser over the rendered cards: name (EN/TH), category, area, description (EN/TH) and amenity names. Words are matched with a trailing plural "s" dropped ("nails" finds "Nail salons"). Results pages have an inline search box behind the top-bar search icon; the city search page filters as you type.
- **Sheets** are native `<dialog>` elements (`Sheet.astro`, `scripts/soiguru/sheet.ts`): a bottom sheet on phones, a centred 480px panel on desktop. **Area** picks one area; **Filters** has price bands, "Show only" (rated 4+, has LINE, has WhatsApp, verified owner) and the 12 most common amenities. Filters live in the URL (`price=1,2`, `rating=4`, `line=1`, `wa=1`, `verified=1`, `am=a,b`); the Filters chip shows the active count.
- **Search this area**: moving the map by hand shows the pill; tapping it limits the list to the visible bounds ("Whole map" clears it). The map sheet steps prev/next (buttons or swipe) through places ordered by distance from the visitor, else from the selected pin.
- **Photo gallery**: listing photos open a full-screen scroll-snap gallery (swipe, arrow keys, prev/next on desktop).
- **Saved**: a heart on each listing stores slugs on the device (`localStorage` key `sg-saved-v1`); `/<city>/saved` lists them (noindex). Saved is a bottom tab and a top-nav link.
- **Thai URLs**: the `soiguru-thai` integration (`src/integrations/soiguru-thai.ts`) copies every SoiGuru page to `/th/…` after the build, swapping `[data-th]` texts, internal links, `lang`, canonical and `og:url`, and adds the Thai URLs to the sitemap. Pages carry `hreflang` en / th / x-default. The EN / ไทย toggle moves between the two URLs.
- **Hours**: today's row moves to the top of the table.
- **LINE / WhatsApp**: official marks from Simple Icons 13.21.0 (CC0) inlined in `icons.ts`.
- **Claim** links go to `claim_url` in `works.yml` (`https://owner.soiguru.com/{city}/claim`, the Next.js ClaimFlow, with `?listing=<slug>` on a listing). The Owner tab, "For owners" and the landing CTA go to `owner_url` (`https://owner.soiguru.com/owner`, the Next.js owner dashboard).

## Not in this pass

ClaimFlow and OwnerDashboard (need accounts; Next.js only), contact-tap counting (needs a backend), a self-hosted map style. See `docs/questions.md` Q30.

## Generic routes

The generic template routes (`/item`, `/category`, `/categories`, `/tag`, `/tags`, `/collection`, `/collections`, `/comparison`, `/comparisons`, `/directory`, `/page`, `/pages`) are still built but not shown on soiguru.com: the `soiguru-redirects` integration (`src/integrations/soiguru-redirects.ts`) writes `dist/_redirects` with 301s (`/item/<slug>` → its listing page, the rest → `/`) and the sitemap leaves them out. The 404 page uses the SoiGuru design.
