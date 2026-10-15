---
id: spec-054-soiguru-city-screens-plan
title: Spec 054 — plan
sidebar_label: 054 plan
---

# Plan — `054-soiguru-city-screens`

1. `lib/soiguru/`: types, hours parsing and open status (Bangkok time),
   formatting (distance, ฿ price band, Thai phone display, contact deep links),
   ranking/filtering, the per-request rendering context and the content
   loaders for `cities.yml`, `categories.yml`, `amenities.yml` and items.
2. `components/soiguru/`: the icon set from the design bundle, the shared
   building blocks (top bars, language toggle, search, chips, category grid,
   listing card, bottom nav) and the server-rendered OSM tile map.
3. `app/[locale]/(soiguru)/`: layout (tokens, fonts, scoped CSS), the landing,
   CityHome, CategoryResults and ListingPage routes.
4. Wire-up: `ConditionalLayout` chromeless segments, `/` rewrite to the
   landing, `soiguru` message namespace in EN and TH.
5. Verify with the soiguru-data sample content in `apps/web/.content`.
