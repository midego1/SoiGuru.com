# 071 — Featured places (SoiGuru)

Status: implemented

## Problem

A listing's `featured: true` (set in the admin item editor, spec 070, or in the content repo)
only changed the build order of the data. The result screens re-sort in the browser (rating,
nearest, recently updated, "Open now" first), so a featured place ended up anywhere in the
list, and nothing on the card said it was featured. Paying customers we feature should be
seen first.

## Behaviour

- **Badge.** A featured listing's card shows a small "Featured" chip (Thai: แนะนำ) with a star
  in the sun colour, in the top-left corner of the card's photo (10px text), so the name keeps
  its full width; on the photo tiles (city home) it is a flag at the top-left of the photo, under
  "Verified owner" when both show. (First version: a badge next to the name, which cut long
  names on phones.)
- **Pinned first.** Area, category and search results (`CategoryResults`, `results.ts`) put
  featured places at the top whatever the chosen sort; the sort orders the places inside each
  group (featured, then the rest). Filters still apply: a featured place that does not match
  a filter, or is closed while "Open now" is on, is not shown and not pinned.
- **Hook.** Cards carry `data-featured="1"`; the sort reads it.

## Not covered

The listing page itself shows no badge. There is no limit on how many places are featured,
and no expiry date; featuring is switched off by setting `featured: false`.
