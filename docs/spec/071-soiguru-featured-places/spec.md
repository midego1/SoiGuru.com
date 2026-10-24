# 071 — Featured places (SoiGuru)

Status: implemented

## Problem

A listing's `featured: true` (set in the admin item editor, spec 070, or in the content repo)
only changed the build order of the data. The result screens re-sort in the browser (rating,
nearest, recently updated, "Open now" first), so a featured place ended up anywhere in the
list, and nothing on the card said it was featured. Paying customers we feature should be
seen first.

## Behaviour

- **Badge.** A featured listing's card shows a "Featured" badge (Thai: แนะนำ) with a star in
  the sun colour: next to the name on list cards, and as a flag at the bottom-left of the photo
  on the photo tiles (city home). "Verified owner" keeps its place; both can show together.
- **Pinned first.** Area, category and search results (`CategoryResults`, `results.ts`) put
  featured places at the top whatever the chosen sort; the sort orders the places inside each
  group (featured, then the rest). Filters still apply: a featured place that does not match
  a filter, or is closed while "Open now" is on, is not shown and not pinned.
- **Hook.** Cards carry `data-featured="1"`; the sort reads it.

## Not covered

The listing page itself shows no badge. There is no limit on how many places are featured,
and no expiry date; featuring is switched off by setting `featured: false`.
