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
