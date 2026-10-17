---
id: spec-055-soiguru-admin-style-plan
title: Spec 055 — plan
sidebar_label: 055 plan
---

# Plan — `055-soiguru-admin-style`

1. Theme preset: add `soiguru` to every preset table, resolve the default from
   `NEXT_PUBLIC_THEME_PRESET` (fallback `soiguru`), add fixed palettes and the
   `data-theme-preset` attribute in `lib/theme-color-manager.ts`.
2. Fonts: move the Plex pair to `lib/soiguru/fonts.ts`; put the variables on
   `<html>` in the root layout; the `(soiguru)` layout reuses them.
3. `app/soiguru-theme.css`: preset-scoped tokens, Tailwind/HeroUI variable
   overrides, base font/ground/focus rules, header and admin overrides.
4. Components: `SoiGuruMark` + karst scene, `SiteLogo` fallback mark,
   `sg-header` hook, `ConditionalLayout` ground, `AdminShellBar`,
   `AdminSignIn`, credentials submit button, stat-card and section icons.
5. Strings: `admin.SHELL` in EN and TH.
6. Verify: lint, `tsc --noEmit`, `next build`, screenshots of the sign-in and
   an admin page at 1280 and 390 px.
