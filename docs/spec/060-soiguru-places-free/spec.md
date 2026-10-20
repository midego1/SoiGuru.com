# 060 — Google Places stays inside the free monthly usage (SoiGuru)

Status: implemented

## Problem

Google photos on listing pages and cards (specs 056, 059) are billed per call once a SKU's free
monthly usage is used up. The owner asked that SoiGuru never pays for them.

## Behaviour

Billable SKUs and their free calls per month (Google Maps Platform pricing since March 2025):

| SKU | What | Free per month | Our cap (default) |
|---|---|---|---|
| Place Details Photos | each photo image | 1,000 | 900 |
| Text Search Pro | finding a listing's place (no stored place ID) | 5,000 | 4,000 |

The photo list (Place Details with only `photos`, "Essentials IDs Only") is free and not counted.

- Before each billable call the owner app adds one to the month's count in
  `soiguru_places_usage` (`month` = Google billing month in Pacific time, `sku` = `photo` or
  `search`), atomically, and only when the count is under today's paced allowance:
  `ceil(cap × day / days in month)`. Over it, the call is skipped and the site shows its drawing.
- Caps can be lowered with `PLACES_PHOTO_MONTHLY_LIMIT` / `PLACES_SEARCH_MONTHLY_LIMIT`; they are
  never allowed above 95% of the free amount.
- When the database cannot be reached the call is refused (no photo rather than a bill).
- The in-memory daily budget (`PLACES_DAILY_LIMIT`, spec 059) stays as a second guard.
- Migration 0044 creates the table and starts October 2026 at 500 photos and 1,000 searches,
  a safe estimate of the two days before the counter existed.
- `monthlyUsage()` returns the month's counts for a future admin view.

## Not covered

Google's free usage is per billing account and SKU. If other projects on the same billing account
use Place Details Photos or Text Search Pro, they share it. A quota on the Google Cloud project
(APIs & Services → Places API (New) → Quotas) is the hard guarantee on Google's side.
