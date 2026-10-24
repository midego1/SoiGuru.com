# 074 — Live preview on the edit pages (SoiGuru)

Status: implemented

## Problem

Owners edit their listing on six screens in the owner app (details, hours, good to know, menu &
prices, photos, billing), and admins edit items in the full-screen item editor (spec 070). None
of them showed how the listing page will look to visitors: you saved, opened soiguru.com and
looked. On a desktop the edit forms used one 720px column and left half the window empty. The
owner asked: "For the edit page on desktop can we do split screen with live view?", form 60%,
preview 40%, on both the owner pages and the admin item editor.

## Behaviour

- **Split screen from 1100px.** The form takes 60% of the page column and the preview 40%, in a
  panel that sticks under the top bar and scrolls on its own when it is taller than the window.
  At 1100px the page column is 1068px, so the preview column (~418px) holds the 390px phone at
  ~94–100% and the form column (~626px) is about as wide as the old 720px form; narrower than
  that, a 60/40 split shrinks the phone under ~90% and the form under ~580px. From 1232px the
  page column stops growing (form ~706px, preview ~470px).
- **The preview.** A React drawing of the public listing page
  (`astro/apps/web/src/pages/[city]/[area]/[slug].astro`), in its phone layout, inside a phone
  frame (390px wide, zoomed to fit the column): photo grid (or "No photos yet"), category chip
  and "Verified owner", name and Thai name, open status computed now (Bangkok time) from the
  hours being edited, rating, price band and area, Call / LINE / WhatsApp / Directions buttons
  with the phone, LINE id and booking note under them, the "Where" card with the address, the
  opening hours table (today first, every day on its own row, closed days in red, the notice
  line), Menu & prices, About (both languages) and Good to know ("No parking" for a "No").
  Nothing in it is a link; a line under it says the buttons don't work. "Phone / Desktop" switches
  to the same page at 1024px laid out like soiguru.com on desktop (photos across, details left,
  where and hours on the right), zoomed down to fit.
- **Live.** The preview follows the form as you type (150ms after the last change, also when
  menu rows are added, removed or moved), with the same rules the save actions use: an emptied
  name keeps the saved one, phone numbers get +66, LINE ids get one "@", a day switched off is
  closed, 23:59 is midnight, half-filled ranges and nameless menu rows are dropped, "Not set"
  amenities are left out. Nothing is saved. When the form differs from what was loaded, the
  panel says **Not saved yet**; otherwise "Same as your live page". After a save the page
  reloads and the preview starts from the saved listing again.
- **The part you edit.** Each page outlines the sections it changes in the sun colour with a
  "You're editing this" tag and scrolls the preview to the first one: details → title, contact
  buttons, where and about; hours → the hours table; good to know → the pills; menu → Menu &
  prices; photos → the photo grid. When that section is empty, a dashed placeholder says
  visitors don't see it until it is filled in (other empty sections stay hidden, as on the
  public page).
- **Below 1100px.** No split: the form stays as it was, and a "Preview" button in the top bar
  opens the same preview in a full-screen dialog (title, close, Not saved yet, Phone / Desktop).
  Escape or the close button returns to the form; the form keeps its values. Nothing overflows
  horizontally from 320px.
- **Photos** has no form (each photo has its own buttons), so its preview shows the saved
  photos and refreshes when a photo is added, removed or made first.
- **Billing** has nothing a visitor sees, so it has no preview and keeps its one column.
- **Admin item editor.** From 1100px the editor's sections and publish settings stack in the
  left 60% and the preview sits on the right 40%, sticky under the editor's bar; below 1100px a
  "Preview" button in the bar opens the dialog. It previews the name, description, category and
  address being edited over the item's saved SoiGuru data (hours, menu, photos, phone, …), which
  this editor doesn't change; it outlines the title and About.
- Strings are in `soiguru.preview` (English and Thai).

## Implementation

- `apps/web/lib/soiguru/live-preview.ts` (client-safe, unit-tested in
  `__tests__/live-preview.spec.ts`): `PreviewListing`, `previewFromListing`,
  `applyFormToPreview` (the form over the saved listing, mirroring `saveDetails`, `saveHours`,
  `saveAmenities`, `saveMenu`; reuses `parseDayHours` and `menuFromForm`), `isDirty`,
  `previewHoursRows`, `previewFromItem` (admin). `live-preview-server.ts` builds the saved data
  with amenity and area names.
- `apps/web/components/soiguru/live-preview.tsx`: `LivePreview` (reads the enclosing form),
  `PreviewSurface` (side panel or dialog), `PreviewOpenButton`, `ListingPreview`; styles in
  `live-preview.css`, scoped to `.sg-pv-*` / `.sg-split` and independent of the window width.
  Status text, prices and hours reuse `getOpenStatus`, `formatRanges`, `formatPrice`,
  `formatThaiPhone` and `formatPriceBand`.
- `EditSplit` and an `action` slot on `EditorBar` in `components/soiguru/owner.tsx`; each edit
  page wraps its form body in `EditSplit` and passes its sections as `focus`.
- `components/admin/items/item-live-preview.tsx` wraps the preview in the SoiGuru tokens for the
  admin and is placed by `item-editor.tsx`.

## Not covered

- The preview is a drawing, not the Astro page: no map tiles (a placeholder with a pin), no
  nearby places, no claim box, no Google photos for listings without their own.
- Without JavaScript the forms work as before; there is no preview.
- The admin preview doesn't know the item's area name in Thai and shows the area id spelled out.
