# 072 — Sticky listing title (SoiGuru)

Status: implemented

## Problem

On a business page (`/<city>/<area>/<slug>`) the name and the breadcrumb scroll away with the
photos. Further down (hours, About, Nearby, the map) a visitor no longer sees which place they
are reading about or where it sits in the site. The site header is sticky, but it only carries
the logo, city picker and search.

## Behaviour

- **A title bar under the header.** Once the page's `h1` has scrolled up behind the sticky site
  header, a compact bar shows right under the header: the breadcrumb (city / area / category,
  12px, one line, ellipsis) above the business name (semibold 17px, 18px from 720px, one line,
  ellipsis). Scrolling back up until the `h1` shows again hides it.
- **By width.** Phones (below 600px): crumbs and name only; the open status and Directions are
  already in the bottom bar. From 600px the open status (dot and text, kept up to date like the
  other statuses) follows the name. From 960px (desktop layout) a small Call button (accent
  colour, 36px) sits on the right when the place has a phone number.
- **No layout shift.** The bar lives inside the sticky header (`SiteHeader` now takes a slot)
  and is absolutely placed below it, so it never moves the page; header pop-ups (city picker,
  account, menu) open over it. On tall desktop windows the sticky side column (hours, map,
  claim) keeps clear of it.
- **Motion.** It fades and slides in over 160ms; with `prefers-reduced-motion` it just appears.
- **Thai.** The crumbs reuse the `data-th` texts of the real breadcrumb, the Call label uses
  "โทร", so the language switch swaps them like everything else.
- **Accessibility.** The bar is a visual copy: `aria-hidden="true"`, its links are out of the
  tab order (`tabindex="-1"`). The real breadcrumb `<nav>` and the `h1` stay where they are, so
  there is no second heading or landmark.
- **Hook.** `scripts/soiguru/lpbar.ts` watches the `h1` with an IntersectionObserver whose top
  margin is the header's height (re-measured when the header resizes) and sets `data-stuck` on
  `[data-lpbar]`.

## Not covered

Other pages (area, category, search) get no title bar. The bar has no Save/Share buttons and,
on phones and tablets, no contact button. The listing's Thai name (`name_th`) is not shown in
the bar.
