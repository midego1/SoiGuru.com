# 070 — Admin item editor on one page

**Status:** implemented · **Date:** 2026-10-24 · **PR:** #55

## Problem

Editing a place in the admin (`/admin/items`, "Places") opened a five-step modal wizard:
Basic Information → Media & Links → Classification → Location → Review & Submit, with a
Next button per step and the Save at the very end. For an admin who wants to change one
field (a name, the Featured switch) that is four clicks of "Next" through steps that hide
the rest of the record, inside a small dialog over the list.

## Behaviour

- **One page, full screen.** Creating or editing an item opens a full-screen editor over
  the list (`components/admin/items/item-editor.tsx`). Every section is visible at once, in
  cards: Basic information, Media & links, Classification, Location (only when the location
  feature is on) and, in a column on the right that stays put while scrolling, the publish
  settings: **Featured** and **Status** (plus the company manager when companies are on).
- **One Save.** The top bar has Cancel and the save button ("Create Item" / "Update Item");
  on phones the save button repeats at the bottom. Save is enabled once every section is
  valid; until then the bar says how many sections need attention. Escape and the X close
  the editor, as the modal did.
- **Same fields, same validation.** The sections are the wizard's step components
  unchanged (`form-steps/*`), each reporting its validity; the editor only lays them out
  together. The submitted payload is identical to the wizard's, so the API, the git write to
  the data repository and the audit trail are untouched. The wizard component
  (`multi-step-item-form.tsx`) stays in the code (R11) but nothing renders it.
- **e2e.** `tests/admin/items-crud.spec.ts` fills every section and saves; the page object
  keeps its locators (the dialog wrapper, `#id`, `#name`, `#slug`, `#description`,
  `#source_url`, the category/tag inputs, the status select, the featured switch).

## How to feature a place

Admin → Places → ⋯ → Edit → **Featured** switch on the right → Update Item. The change is
committed to the data repository as `featured: true`; the public site rebuilds and sorts
featured listings first in every list (home, category, area, search). There is no visual
badge for featured places yet (see `docs/questions.md`).

## Not covered

- A dedicated route per item (`/admin/items/<id>/edit`); the editor is still state on the
  list page, so a reload returns to the list.
- Owner-side featuring or payment for a featured spot.
