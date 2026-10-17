---
id: spec-055-soiguru-admin-style
title: Spec 055 — SoiGuru admin and app style
sidebar_label: 055 SoiGuru admin style
---

# Feature spec — `055-soiguru-admin-style`

## 1. Summary

The SoiGuru public screens (spec 054) use the moodboard design system (sea and
sun on sand, IBM Plex Sans + Thai). The rest of the app (the template header,
the admin, the admin sign-in and the client dashboard) still used the Ever
Works template look: Geist/sans-serif, blue accents and near-black primary
buttons. This spec brings those surfaces onto the same tokens, mostly through
a theme preset and CSS-variable overrides, without restructuring components.

## 2. Motivation

Owners and admins move between the public screens (claim flow, `/owner`,
`/owner/review`) and the template's admin and client pages. Two visual
languages in one product read as two products.

## 3. Decisions

- **Theme preset `soiguru`** added to the template's preset system
  (`ThemeKey`, `THEME_CONFIGS`, `EXTENDED_THEME_CONFIGS`, `THEME_INFO`,
  `THEME_DEFINITIONS`, theme-switch previews, `theme-utils` presets, the
  settings-service type): primary #0a6b73 (sea), secondary #f2a33a (sun),
  accent #064a50 (sea-deep), background #f4f5f2 (sand), surface #ffffff, text
  #14201f, textSecondary #5a6665. The other presets stay.
- **Default preset**: the template had no config-driven preset default, so
  `NEXT_PUBLIC_THEME_PRESET` (build-time, same value for both nested
  `LayoutThemeProvider`s) selects it; unset or unknown falls back to
  `soiguru`. A visitor's saved choice in `localStorage.themeKey` still wins.
- **Hand-tuned palettes**: `generateColorPalette` gives a near-white 50 shade
  only for mid-lightness bases; for sea it produced #87d5db at 50 and black at
  700–950. `THEME_PALETTE_OVERRIDES` in `lib/theme-color-manager.ts` lets a
  preset ship fixed 50–950 shades; only `soiguru` uses it.
- **`data-theme-preset`** is written on `<html>` when a preset is applied, so
  CSS can scope preset-specific rules. `app/soiguru-theme.css` scopes every
  rule to `:root:where(:not([data-theme-preset]), [data-theme-preset='soiguru'])`:
  before hydration (no attribute) the deployment default applies, so the first
  paint is already SoiGuru; picking another preset turns the look off.
- **Global look** (`app/soiguru-theme.css`, imported by the root layout after
  the template globals): IBM Plex Sans + IBM Plex Sans Thai as the app font
  (one `next/font` declaration in `lib/soiguru/fonts.ts`, shared with the
  `(soiguru)` layout); sand page ground (`--app-ground`, used by `<body>` and
  `ConditionalLayout`'s `<main>`); Tailwind's gray/neutral scale re-tinted to
  the moodboard's green-grey at the same lightness steps; Tailwind's blue
  scale, HeroUI primary/focus and Tiptap accents mapped to sea; 2px sea focus
  outline (base layer, so components that opt out keep their own ring); prose
  links in sea; h1–h3 with -0.01em tracking. Dark mode follows the template's
  `.dark` class with the moodboard's dark values; `--theme-primary` becomes
  #1a838b in dark so white button text keeps 4.5:1.
- **Admin shell** (`app/[locale]/admin/layout-client.tsx`): the plain "Admin
  Panel" strip becomes `AdminShellBar` (logo mark + "SoiGuru" wordmark +
  "Admin" label, and a horizontal section nav with the active item in sea on
  sea-tint, 44px targets, sideways scroll on phones; it links the claim queue
  at `/owner/review`). The wrapper carries `sg-admin`, which turns the
  template's near-black primary actions (`bg-gray-900` / `dark:bg-white`:
  "Add Category", "Create First Category", form submits, checked toggles,
  page-header icon tiles) into sea with a sea-deep hover, and gives white
  cards a 16px radius. Stat cards and dashboard section icons sit on the
  brand tint in the brand colour.
- **Admin sign-in**: `/admin/auth/signin` renders `AdminSignIn` (left panel
  on sea-deep with the logo mark and a karst scene in sea tones, right panel
  the unchanged `CredentialsForm` in client mode). The credentials form's
  submit button uses `bg-theme-primary` (hover `bg-theme-accent`, 44px,
  10px radius) instead of near-black; that also brands the client sign-in.
- **Template header**: unchanged navigation; `sg-header` gives it a solid
  surface, a line border and the Plex font, and `SiteLogo` draws the SoiGuru
  mark next to the 800-weight wordmark when `works.yml` has no logo image or
  favicon (`NEXT_PUBLIC_BRAND_MARK=everworks` restores the template icon).
  The text logo no longer flashes a placeholder before mount (only the image
  logo depends on the colour scheme).
- **Owner screens** (`/owner`, claim flow, `/owner/review`) already use the
  `tkg-*` design system; they now share the font files with the rest of the
  app. `soiguru.css` is unchanged.

## 4. Non-goals

- Rewriting admin components or replacing HeroUI/shadcn primitives.
- A sidebar layout for the admin (the bar keeps every page's own layout).
- Translating the new admin strings beyond EN and TH (other locales fall back
  to English through the existing deep merge).

## 5. Acceptance

- `/admin/auth/signin` shows the sea-deep brand panel and a sea "Sign in"
  button; the sign-in flow (including the 2FA step) behaves as before.
- Admin pages show the SoiGuru bar with the current section active, a sand
  ground, white 16px cards and sea primary buttons.
- The template header shows the logo mark and the SoiGuru wordmark.
- The SoiGuru public and owner screens look as before.
- `pnpm --filter @ever-works/web lint` and `exec tsc --noEmit` pass.

## Follow-up (2026-10-17)

- Admin bar: the "Admin" label and section nav only; the site header carries the logo and name.
- Currency: THB (฿) is the default (hook, context, currency API fallback, sponsor-ads setting); the other supported currencies stay selectable.
- Settings drop-downs (`SettingSelect`) render in a portal by default, so the accordion cards do not clip their options.
