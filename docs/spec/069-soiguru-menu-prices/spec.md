# 069 — Menu & prices (SoiGuru)

Status: implemented

## Problem

A listing could say what a place is, when it opens and how to reach it, but not what it
offers and what it costs. Owners could only photograph a menu (claim flow, spec 064), which
Thai readers and the search box cannot read. The price band (฿–฿฿฿฿) is too coarse for
"gel manicure 500 baht" or "island day trip from 1,500".

## Behaviour

- **Data.** A listing's `menu` is a list of sections, each with a title (English, optional
  Thai) and items: `name`, `name_th`, `price` (baht), optional `price_max` (a range), `from`
  (a starting price), `note` and `note_th`. `menu_note` / `menu_note_th` go under the list
  ("Prices include VAT"). A flat list of items is accepted as one untitled section. Limits:
  12 sections, 40 items each, names 80 characters, prices up to 999,999.
- **Public site.** A "Menu & prices" card above "About" on the listing page, with section
  headings, name/price rows, the per-item note and the note under the list. Thai twins via
  `data-th`, so the `/th/` page and the ไทย switch show the Thai names; a price shows as
  `฿350`, `฿500–700` or `from ฿50` (`เริ่ม ฿50`). Item and section names feed the search
  text, so "manicure" finds the nail studio.
- **Structured data.** Restaurants, cafés and bars get a schema.org `Menu` (sections, items,
  offers in THB); every other trade an `OfferCatalog` of `Service` offers. Ranges and
  "from" prices use a `PriceSpecification` with `minPrice`/`maxPrice`.
- **Owner app.** A "Menu & prices" row on the owner dashboard (with the item count and a
  nudge when empty) and an editor at `/owner/<city>/<slug>/menu`: sections with a title in
  both languages and rows of name, Thai name, price, "to" price, a "from" switch and a note
  in both languages. Native inputs only, so it works without script: every section shows a
  few blank rows and an empty section follows the last; clearing a name removes that row on
  save, and a section without rows is dropped. Saving writes `menu` to the content repo like
  hours and amenities and republishes the site (spec 062).
- Works for every trade: dishes, treatments, day trips, rental rates.

## Not covered

- No photo per item, no currency other than baht, no "sold out" state.
- The menu photo from the claim flow stays a photo; it is not linked to the list.
- Prices are not validated against each other beyond `price_max > price`.
