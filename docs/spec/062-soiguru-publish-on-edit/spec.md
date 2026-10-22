# 062 — soiguru.com republishes when the content changes (SoiGuru)

Status: implemented (needs two repository secrets)

## Problem

soiguru.com is a static build. Owner edits (hours, details, amenities, photos — specs 053, 061)
are committed to the `data` branch at once, but the public site only showed them after someone
deployed the site by hand. Owners expect their change to be live the same day, and Google
ranks fresher pages better.

## Behaviour

- `.github/workflows/publish-site.yml` runs on every push to the `data` branch and on
  manual dispatch. It checks out the site code from `develop`, clones the `data` branch as
  content (`DATA_REPOSITORY_BRANCH=data`), builds the Astro site and deploys the Worker with
  `wrangler deploy`, the same command used for manual deploys.
- A burst of edits ends in one deploy: a newer run cancels the one still building
  (`concurrency` with `cancel-in-progress`).
- GitHub runs a push-triggered workflow from the pushed branch, so the same workflow file also
  lives on the `data` branch (`.github/workflows/publish-site.yml` there, kept identical).
- Code changes on `develop` keep deploying through Cloudflare Workers Builds; this workflow
  only covers content.
- Needs two repository secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) and
  `CLOUDFLARE_ACCOUNT_ID`. Without them the deploy step fails and the previous site stays up.
- The owner app's "after the next site update" wording (spec 061) stays true: a change is live
  within a few minutes.

## Not covered

Data imports pushed by hand also trigger a publish, which is intended. There is no preview of a
content change before it goes live; the owner app is the place to look at it.
