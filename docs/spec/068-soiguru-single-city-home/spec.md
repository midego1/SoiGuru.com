# 068 — One city: the city page is the home page (SoiGuru)

Status: implemented

## Problem

With one city in `cities.yml` the landing page said "Krabi" four times (eyebrow, button, map
pin, the only city card) above a large empty hero, and a visitor had to click once more to
reach anything useful. For Google the root was a thin page.

## Behaviour

- When exactly one city is configured, the build writes temporary redirects: `/` → `/<city>`
  and `/th/` → `/th/<city>` (302, in `_redirects`, served by Cloudflare before any file). The
  landing page is still built and comes back by itself when a second city is added: the
  redirect lines are then not written.
- The sitemap leaves `/` and `/th/` out while the redirect is in place.
- 302 rather than 301 on purpose: the move is temporary and the root should stay the root for
  search engines once there are several cities.

## Not covered

Nothing on the city page changes; the "Cities" picker in the header still lists the one city.
