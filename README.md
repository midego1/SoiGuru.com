# soiguru-data

Content repository for [SoiGuru.com](https://soiguru.com): cities, areas, categories and listings. It uses the Ever Works data format (same layout as `ever-works/awesome-time-tracking-data`) and is read by both site templates through `DATA_REPOSITORY`.

> **All listings in `data/` are SAMPLE businesses** (`sample: true`, tag `sample`, phone numbers starting `+66800`, LINE ids `@sample-…`). They exist for development and design review. Replace them before launch.

## Layout

```
.works/works.yml      site config (auth: credentials only)
categories.yml        shared categories, all cities (id, name, name_th, description, priority)
cities.yml            cities and their areas (SoiGuru extension)
amenities.yml         amenity ids with EN/TH labels (SoiGuru extension)
tags.yml              tags (id, name)
collections.yml       empty for now
pages/                static pages (about.en.md)
data/<slug>/<slug>.yml   one listing
data/<slug>/<slug>.md    the same listing's long description (Next.js reads this; Astro reads `markdown:` in the YAML)
```

URLs are `/<city>/<category>` and `/<city>/<area>/<slug>`. Slugs are unique across all cities.

## Listing fields

Standard Ever Works fields: `name`, `description`, `source_url`, `category` (one category **id** from `categories.yml`), `tags` (tag ids), `featured`, `status: approved`, `updated_at`, `markdown`.

SoiGuru fields:

| Key | Type | Notes |
|---|---|---|
| `city` | city id | from `cities.yml` |
| `area` | area id | an area of that city |
| `name_th` | string | Thai name; omit when the owner gave none |
| `description_th` | string | Thai description |
| `address` | string | street address as shown |
| `geo` | `{lat, lng}` | WGS84 decimal degrees |
| `location` | `{address, city, country, latitude, longitude}` | same data in the Next.js template's `ItemLocationData` shape, which its map index reads |
| `phone`, `whatsapp` | string | E.164, quoted (`"+66812345678"`); display as 08x-xxx-xxxx |
| `line_id` | string | LINE id, e.g. `@krabinail` |
| `hours` | map `mon`…`sun` → list of `"HH:MM-HH:MM"` | 24-hour clock; `[]` = closed that day; two ranges = split day; `00:00-24:00` = open 24 hours |
| `hours_note` | string | optional temporary closure / holiday line |
| `booking_note` | string | optional one-line note from the owner |
| `price_band` | 1–3 | shown as ฿ / ฿฿ / ฿฿฿ |
| `rating` | number 0–5 | one decimal |
| `rating_count` | integer | |
| `claimed` | boolean | true shows the Verified owner badge; false shows the claim box |
| `amenities` | map amenity id → boolean | `true` = has it; `false` = notably missing (shown with a cross, e.g. no parking) |
| `updated_by` | `owner` \| `import` \| `editor` | for the "Updated by the owner 3 days ago" line |
| `updated_at` | `"YYYY-MM-DD HH:mm"` | quoted; the Next.js template parses exactly this format |
| `sample` | boolean | true on placeholder listings |

Optional keys are left out rather than set to null.

## Thai-language overrides

The Next.js template also merges `data/<slug>/<slug>.th.yml`, `<slug>.th.md` and `categories.th.yml` for the `th` locale. The `*_th` keys above are the primary source; locale files are optional.
