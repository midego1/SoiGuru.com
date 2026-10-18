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

> Superseded by § Website layout for the landing, CityHome, ListingPage and 404; still describes CategoryResults, search and saved.

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

## Website layout

The public site follows the layout of the website mockup (artifact "Main" and "Listing" screens) drawn with this design system's tokens. Phone first; breakpoints 720px (tablet), 960px (desktop), 1100px (header links in the bar). Content sits in a 1200px column (`.sg-wrap`); the hero and footer span the window.

- **Header** (`SiteHeader`, every page; back-mode pages keep their app bar on phones and show the header above a title row from 960px): logo mark + wordmark, city picker (`<details>`), the city's links (Eat & drink, Cafés, Things to do, Stay, Map = `/<city>/search?view=map`), EN / ไทย, the account menu (a profile button, see **Accounts**), List your business (`claim_url`). Phones: logo and city in the header; the bottom tab bar (Home, Search, Saved, Account, Menu) is on every page, fixed to the bottom of the screen (placed by `SoiGuruLayout`); Menu opens a bottom sheet with the links, the cities, EN / ไทย, Owner login and List your business. From 960 to 1099px the header has a menu button; from 1100px the links sit in the bar. On the listing page a search field replaces the links.
- **CityHome**: hero on the dark sea ground (eyebrow with the areas and local time, headline, what + where search posting `q` and `area` to `/<city>/search`, Open now / Near me / Map chips, three trust ticks, a drawn karst scene from 960px); category tiles for every category with places (4-up on phones, 8 per row from 960px); "Open now" photo cards (4 on phones, 8 on desktop, 10 from 1440px; one place per category in turn; a category mark when there is no photo); "Browse by area" cards for areas with places; the owner block; footer.
- **Landing**: the same hero with one button per city, city cards, owner block, footer.
- **ListingPage**: breadcrumb (city / area / category / name); photo grid (1 big + up to 4); chips (category, Verified owner, Sample), title, Thai name, status · rating · price · area/distance; action row (first channel in the accent colour, then LINE, WhatsApp, Directions, Save, Share); About, Good to know pills, then the body sections. Side column (between head and body on phones; from 960px it starts level with the photos and runs the full height, sticky on windows at least 1040px tall): Location card first (240px static map with the pin, address, distance from the visitor once known; without coordinates Google's embedded map for the name and address (keyless `maps.google.com/maps?output=embed`, lazy; no Google coordinates are stored, per the Maps terms), the address), then Google Maps (directions to the point, or a search for name and address) and Apple Maps side by side, and Copy address (copies the address, says "Copied" for two seconds; `[data-copy]` in `page.ts`)), Opening hours card with the provenance line, claim card, out-of-date note, report link. From 960px the photos sit in the main column only: one big photo with two stacked beside it (more open in the gallery). The main column ends with Nearby · open now and "More <category> in <area>" (the area when it has 3+, else the city) as photo-card grids, swipeable rows on phones. Phones keep the sticky Directions bar.
- **Footer**: brand line, cities with counts, business links, the other language, © and the OpenStreetMap (ODbL) credit.
- **Theme**: `theme` in works.yml, or `SITE_THEME` at build time, sets `<html data-theme>`. `soiguru` (default): sea `#0a6b73`, sun `#f2a33a` accent with ink text, IBM Plex Sans + Thai, light and dark. `navy`: the mockup's own palette (navy `#10272b`, orange `#c2410c` with white text, teal `#0b5f5b`), Bricolage Grotesque headings, Figtree text, IBM Plex Sans Thai for Thai; light only. Same pages and markup; only tokens and fonts change.
- **Accounts** (header account menu, 2026-10-18): the site stays static with no accounts of its own; accounts live in the owner app (`account_url` in works.yml, else the origin of `owner_url`). A profile button in the header (960px+) and the Account tab (phones, opens a sheet) show the same panel (`AccountPanel`). Signed out: "Sign in to keep your saved places on every device", Sign in, Create account, Saved places, Business owner login. Signed in: initial avatar and name, Saved places (count), My business (owners or anyone with a claim) or Claim your business, Account settings, Admin (admins only), Sign out. `scripts/soiguru/account.ts` asks `GET <account>/api/soiguru/me` with the owner app's cookie (same site) and caches the answer for the tab session; unreachable means the signed-out panel, whose links still work. Sign in, create account and sign out come back to the page they were opened on (`/return?to=` on the owner app, spec 058 of the Next app). Saved places: the first answer after signing in merges the device's saved places into the account (nothing removed) and the device list becomes the account's list; afterwards every heart tap is sent to the account (`POST <account>/api/soiguru/saved`). Signed out, saved places stay on the device only. Without an owner app configured the header keeps "Owner login" and the tab bar the Owner tab.
- **Analytics**: Umami (`script.js`, `recorder.js`) in `SoiGuruLayout`; buttons carry `data-umami-event` (`contact-<channel>`, `claim-listing`, `claim-cta`, `list-business`, `owner-login`, `account-menu`, `account-tab`, `account-signin`, `account-register`, `account-signout`, `account-settings`, `account-business`, `account-claim`).
- **Wide screens**: the content column is 1200px, 1440px from a 1440px window. Open-now cards: 4 columns from 960px (8 shown), 5 from 1440px (10 shown). Results pages from 1360px: list 46% with two card columns, map beside it.
- **Results** (category, area, search), design A: a directory by default. Desktop: breadcrumb, title and count, toolbar (List | Map, Open now, area, sort, search), a sticky filter sidebar (area with counts, price, show only, good to know) beside a grid of cards. Map view: the list beside the map, fitting the window (no page scroll), Show more / Show closed pinned under the list. Phones: compact rows; a floating Map / List button above the tab bar.
- **Results filters** (sidebar card on desktop, sheet on phones): collapsible sections with counts: Open (open now with the live count, open 24 hours; desktop only, phones keep the toolbar chip), Area, Contact (phone, LINE, WhatsApp), Rating (minimum: any / 3+ / 4+ / 4.5+), Price, More (verified owners, open 24 hours), Good to know (amenities). Sections without data start folded with their options disabled. Active filters are removable pills above the sections. The Categories card lists every category with places and a count, A–Z by default, or Hot (site order) (remembered on the device).
- **Live theme**: `soiguru`, the moodboard (bundled works.yml): page on `surface-100` (sand), cards and bars on `surface`, category tiles on `sea-tint`.
- **Drawn map of Thailand** (`ThailandMap`): the city picker panel (cities with counts beside the map; hover lights the pin) and the landing hero card. Outline from Natural Earth (public domain) as one inline SVG path; no tiles or map library.
- **Owner block**: pitch (eyebrow, headline, lead, "Find your shop" search with the place count, three steps, Claim button, price) beside the claim banner image (`public/images/claim-banner.webp`, linked to the claim flow); stacked on phones.
- **Places without photos**: a drawn scene per category (`CategoryArt`: noodle bowl, cocktail, coffee cup, shop window, hotel, massage mat, karsts and longtail, boxing gloves on ring ropes, fish and coral, clinic cross, washing machine, barber pole, nail polish, scooter, laptop desk; shopfront for other or unknown categories), with an accent colour per category (one of the five area colours); no icon badge. Used on photo cards and on the listing page. On the listing page the browser then asks the owner app for Google Places photos (`<owner origin>/api/places/photos/<slug>`, spec 056 of the Next app; `scripts/soiguru/places.ts`) and swaps in up to three, each with "Photo: <author> on Google" linking to the author. No answer within 8 s, an error or no photos keeps the drawing.
- **Favicon**: the logo mark as SVG + ICO + Apple touch icon + 192/512 PNGs with a web manifest (`public/`), linked by `SoiGuruLayout` unless `logo.favicon` is set.

## Later (backlog, 2026-10-17)

- **PromptPay via Stripe** (owner payments, ฿100 / month or ฿1,000 / year). Needs a Stripe account registered in Thailand (Stripe offers PromptPay only to TH accounts, THB only). Yearly: Stripe Checkout with PromptPay QR + card. Monthly: PromptPay cannot be charged automatically, so each month a new Stripe invoice with a PromptPay QR is sent to the owner on WhatsApp / LINE to scan (cards stay available for automatic monthly billing). Build it so PromptPay shows only when the Stripe account supports it.
- **Google Places photos as fallback** (owner photos first, then up to 3 Places API (New) photos loaded live with the author credit, then the category drawing). Listing page done (see Website layout); photo cards still show the drawing (one Places call per card would cost too much). Key `GOOGLE_PLACES_API_KEY` is set on the owner app; place IDs may be stored, photos may not be cached.
- **Publish on edit**: GitHub Action on the `data` branch that rebuilds and deploys soiguru.com (needs the owner's OK and the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets).
- **One frontend**: owner.soiguru.com public template pages redirect to soiguru.com; the server keeps `/admin`, `/owner`, the claim flow and sign-in.
