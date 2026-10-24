# 058 — Accounts for the public site (SoiGuru)

Status: implemented

## Problem

The public site soiguru.com is a static Astro site on Cloudflare with no accounts. Visitors
could only save places on their device, and the header only offered "Owner login". This app
already has every account feature (register, sign in with e-mail and password or Google /
GitHub / Facebook / X when configured, forgot and new password, e-mail verification, e-mail
2FA, the `favorites` table, the client dashboard and settings, the owner dashboard and claim
flow), but the public site could not tell who is signed in, sign-in never came back to
soiguru.com, and the sign-in screens still showed the template's copy and look.

## Behaviour

### Who is signed in — `GET /api/soiguru/me`

- Called by the public site with `credentials: 'include'`. soiguru.com and owner.soiguru.com
  are the same site, so this app's `SameSite=Lax` session cookie is sent.
- CORS only for the public site origins (`PUBLIC_SITE_ORIGINS`, default
  `https://soiguru.com,https://www.soiguru.com`), with `Access-Control-Allow-Credentials`.
- Response: `{ signedIn: false }` or `{ signedIn: true, name, image, initial, isAdmin,
  isOwner, hasClaims, saved }`. `saved` is the account's saved listing slugs, newest first.
  No e-mail address or ids. `Cache-Control: no-store`.

### Saved places — `POST /api/soiguru/saved`

- Body `{ add?: string[], remove?: string[] }` (listing slugs, max 500 each), sent as
  `text/plain` JSON so no preflight is needed. Only slugs of listings in the content
  repository are stored (`lib/soiguru/saved.ts`, the template's `favorites` table).
- Refused with 403 when the `Origin` is neither a public site nor this app, 401 when signed out.
- Responds with the account's saved slugs.

### Back to the public site — `GET /return?to=<url>`

- The sign-in form only accepts relative callback URLs, so the public site sends
  `callbackUrl=/return?to=https://soiguru.com/<page>`. `/return` redirects (303) to `to` when
  its origin is a public site, else to the public site's home. Works under a locale prefix.

### Sign-in screens in the SoiGuru look

- `app/[locale]/auth/layout.tsx`: every `/auth` screen gets a slim bar (SoiGuru mark linking
  to the public site, "Back to SoiGuru" linking to the page the visitor came from) on the
  sand ground. `auth` is chromeless in the root layout, so the template header and footer are
  left out.
- `/auth/signin` and `/auth/register` render `SoiGuruAuthCard`: SoiGuru heading and copy,
  three perks on register, the template's `CredentialsForm` (new `hideHeader` prop) with the
  social buttons, and a note for business owners. Every behaviour of the form is kept
  (callback URL, 2FA, captcha, locale). The template's `AuthForm` stays for the admin sign-in.
- The switch link ("Create account" / "Sign in") keeps the callback URL.
- English and Thai texts under `soiguru.account`; Thai fills the form's missing strings.
- Forgot password, new password and verification keep their template cards inside the shell.

### Sign out — `/auth/signout?to=<url>`

- Signed in: "Sign out of SoiGuru?" with a Sign out button (a server action, so a link
  elsewhere cannot sign anyone out) and Cancel; afterwards back to `to` via `/return`.
- Signed out: "You are signed out" with Sign in and Back to SoiGuru.

### Middleware

- `/auth/signout` is no longer redirected away for signed-in users.
- A signed-in visitor opening another `/auth` page with a safe relative `callbackUrl` goes to
  that URL (so "Sign in" from a stale menu returns to the public page) instead of the dashboard.

## Files

- `lib/soiguru/public-site.ts` — public origins, `safePublicUrl`, `publicSiteCors`.
- `app/api/soiguru/me/route.ts`, `app/api/soiguru/saved/route.ts`, `app/[locale]/return/route.ts`.
- `app/[locale]/auth/layout.tsx`, `app/[locale]/auth/sg-auth.css`, `app/[locale]/auth/signout/page.tsx`.
- `components/soiguru/auth-card.tsx`, `components/soiguru/auth-back-link.tsx`.
- `app/[locale]/auth/signin/page.tsx`, `app/[locale]/auth/register/page.tsx`,
  `app/[locale]/auth/components/credentials-form.tsx`, `app/[locale]/layout.tsx`, `proxy.ts`,
  `messages/en.json`, `messages/th.json`.

## Public site side

The Astro site (branch `claude/soiguru-astro-cloudflare-deploy-18er0p`, `astro/`) shows a
profile button and an Account tab (`AccountPanel.astro`, `scripts/soiguru/account.ts`); see
`astro/.specify/features/soiguru-design.md` (Accounts).

## Not in this change

- Social sign-in needs each provider's client ID and secret in the deployment env; without
  them only e-mail and password show.
- The forgot / new password and verification cards are not restyled beyond the shell.

## Update 2026-10-23: forgot and new password in the SoiGuru card

The forgot-password and new-password screens now use the same white SoiGuru card as sign in
(`components/soiguru/password-cards.tsx`): SoiGuru copy in English and Thai
(`soiguru.account.*`), native fields, the SoiGuru button, a short password checklist (three of
five checks, as the template's rules) and clear states for a sent link, an expired link and a
saved password. They call the template's server actions unchanged, so tokens, e-mail and rate
limits are the template's. The template's two-column screens remain in
`app/[locale]/auth/*/*-client.tsx` for the admin side.

## Update 2026-10-23: the owner host serves accounts, owners and the admin only

owner.soiguru.com still carried the template's directory pages (home, categories, items, tags,
blog, pricing, …) and the earlier SoiGuru city pages, which looked like a second, different
website. The proxy now keeps only `/owner/*`, `/<city>/claim`, `/auth/*`, `/admin/*`,
`/client/*`, `/dashboard/*`, `/return` and `/api/*` on that host; the root goes to `/owner`;
city paths (`/krabi`, `/krabi/ao-nang/<slug>`) redirect to the same path on soiguru.com, the
legal pages to `/privacy` and `/terms`, everything else to the site root (302). The rule is
`lib/soiguru/owner-only.ts` (pure, unit-testable); `SOIGURU_OWNER_APP_ONLY=false` switches it
off, and it never applies on the canonical host, where the template pages are the site. The
pages themselves stay in the code (R11).

### Why the rule only reached production on 23 Oct 09:45 (and the deploy rule it leaves behind)

PRs #51 and #52 were merged and built, yet owner.soiguru.com kept answering `/categories` and
`/krabi` with 200, and neither the `X-Robots-Tag` header (spec 057) nor the new diagnostic header
ever appeared. The cause was outside the repository: the Dokploy application `SoiGuru.com-web`
carried a **patch** (Dokploy › Patches, created 2026-10-15 01:35, `apps/web/proxy.ts`, type
`update`) that overwrote the whole file after every clone and before every build ("Applying 1
patch(es)…" in the deployment log). Its content was byte-for-byte the proxy of commit `c939823`
(the secure-cookie hotfix of 15 Oct, which was committed to the repo the same morning), so every
proxy change since then was built from that stale copy. The tell: a commit touching only
`proxy.ts` produced a build in which every Docker layer, including `COPY . .`, was `CACHED`.

Fix: the patch (`6JGyPUAgBorGl8IMoRc7f`) is disabled, not deleted, and the app was deployed again
(a Dokploy *redeploy* reuses the old image; a *deploy* clones and builds). Rule from here on:
**no Dokploy patches on this app**. A production hotfix goes into the repository on
`design/soiguru` (and a PR into `develop`) like any other change; if a patch is ever needed to
survive an outage, it is removed in the same hour the commit lands. When a deploy of a code change
finishes in seconds with every layer cached, check Dokploy › Patches first.

`/__owner-rule` (answered by the proxy itself, JSON, no secrets) stays as the diagnostic for this
rule: it shows the host the proxy saw, whether the rule is armed and where `/categories` would go.
Site targets end with a trailing slash (`/krabi/`, `/privacy/`): the Astro site answers on those
and would otherwise add a 307 of its own to every redirect.

### Follow-up 2026-10-23 (PR #54): verification pass

- **RSC fetches.** A `<Link>` prefetch or client-side navigation to a site-bound path was
  answered with the cross-origin 302; the browser followed it to soiguru.com, which has no
  CORS headers for it, and every link in the template chrome (`/submit`, `/tags`, `/pricing`,
  …) logged a console error on the sign-in and client pages. Next strips the `RSC` header
  before the proxy runs, so such fetches cannot be told apart from other fetches; the proxy
  therefore keeps the 302 for browser navigations (`Sec-Fetch-Mode: navigate` or an `Accept`
  with `text/html`) and rewrites everything else to `/<locale>/site-redirect?p=<path>`
  (`app/[locale]/(soiguru)/site-redirect/page.tsx`), whose `redirect()` travels inside the
  flight payload and is performed by Next's router as a full navigation. The target is always
  recomputed by `ownerAppRoute` from the path, never taken from the request, so it is not an
  open redirect.
- The owner dashboard's "View" button links straight to the listing on the public site
  (`PUBLIC_SITE` + path + `/`) instead of the app's own city page.
- `discover` (the template's paginated listing) is a template root too, so `/discover/1` goes
  to the site root instead of a non-existent `/discover/1/`.
- The switch `SOIGURU_OWNER_APP_ONLY` is read **at build time** (the proxy bundle inlines
  `process.env`); set it as a build argument, not only in the runtime environment. The e2e
  workflow and the Playwright `webServer` set it to `false`, because the suite exercises the
  template pages on localhost.
- The forgot/new-password cards give their inputs the ids the e2e suite uses (`#email`,
  `#password`, `#confirmPassword`).
- Verified locally against a standalone build (the production server): sign-in, owner
  dashboard, details/hours/amenities/menu/photos/billing, a Menu & prices save and reload,
  admin sign-in and the admin dashboard, items, users, categories and settings pages; unit
  suite (`test:unit`, 263 → 265 tests) and the e2e specs for auth, admin sign-in, protected
  admin pages and the public smoke list.

### Follow-up 2026-10-24 (PR #55): no template links inside the admin

The template header on `/admin/*` showed Home, Favorites, Categories, Tags, Submit and More;
on the owner host those lead to the public site. `components/header/index.tsx` hides the
navigation (desktop links, the phone menu and its toggle) when the path is under `/admin`;
the brand, settings, language, theme, notifications and the account menu stay, and the admin
keeps its own bar. The client area (`/client/*`) still shows them; say so if they should go too.

### Follow-up 2026-10-24 (PR #60): create-account card

- "Back to SoiGuru" moved from the right end of the bar to just above the card, on its left
  edge (it looked stranded on wide screens and wrapped to two lines at 320px); the logo is
  centred in the bar. Applies to every `/auth` screen.
- Create account shows the password rule under the field ("At least 8 characters", the
  server's `PASSWORD_MIN_LENGTH`) while the focus tips are closed (`passwordHint` prop on the
  template `CredentialsForm`, used only by the SoiGuru card) and a Terms of use / Privacy
  policy line (PDPA) linking to soiguru.com.
- Wording: the submit button says "Create account" (was "Register"; Thai "สร้างบัญชี"), labels
  are sentence case ("Full name", "Email address"), "Sign in" instead of "Sign In". These are
  the template's shared `auth.*` strings, so the admin sign-in follows.
- Less padding above and below the card on desktop (the create-account card fits a 900px-high
  window without a scrollbar); tighter perks list under 480px.
- Checked at 320, 375, 390, 414, 768, 1024, 1280 and 1440px: no horizontal overflow.
