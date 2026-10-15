# 054 — SoiGuru Astro site

**Status:** in-progress

## Why

SoiGuru is built twice from the same design for an A/B comparison: the Next.js app in `apps/web` (Dokploy) and a static Astro site (Cloudflare Pages). Keeping both in this repo means one place for code, issues and PRs.

## What

- `astro/` holds the full Astro monorepo from `midego1/directory-web-minimal-template` (branch `design/soiguru`): `apps/web` is the SoiGuru site, `packages/*` its data layer, UI and plugins.
- It is a separate pnpm workspace with its own `pnpm-lock.yaml`. The root workspace (`apps/*`, `packages/*`) does not include it, and `.dockerignore` keeps it out of the Next.js image.
- Its own `.github/workflows` are inactive here (GitHub only reads the root `.github`).
- The feature spec for the screens is `astro/.specify/features/soiguru-design.md`.

## Build and deploy

```bash
cd astro
pnpm install
ENABLE_ISR=false pnpm --filter @ever-works/web-minimal build   # output: astro/apps/web/dist
```

Cloudflare Pages: root directory `astro`, the build command above, output `apps/web/dist`, `NODE_VERSION=22.12`.

## Open

- Whether the Astro site stays after the A/B comparison, or is removed once one build is chosen.
