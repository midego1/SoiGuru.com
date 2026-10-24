# 073 — Sign-in links and branded emails (SoiGuru)

Status: implemented

## Problem

Signing in to owner.soiguru.com needed a password, which owners forget and which is the main
reason a sign-in fails on a phone. The emails the app sent were the template's (a one-line
"Click here to reset password", a generic verification layout), not SoiGuru's, and nobody
could see or change them without a deploy. Mail goes out through Amazon SES.

## Behaviour

### Sign-in link

- **Primary path.** The sign-in and create-account cards (`components/soiguru/auth-card.tsx`)
  start with an email field and "Email me a sign-in link". The template's password form, with
  its 2FA step, captcha and social buttons, is one tap away behind "Use a password instead"
  and stays mounted, so switching back and forth keeps what was typed
  (`components/soiguru/magic-link-sign-in.tsx`).
- **New and existing addresses.** The answer is the same either way, so the form does not
  reveal whether an account exists. Opening the link signs in an existing user (admins land in
  `/admin`) or, the first time, creates the user and client profile, like an OAuth sign-up. The
  address is marked verified (`users.emailVerified`), since the link proves the mailbox.
- **The link.** `/auth/magic-link?token=…` (plus `callbackUrl` when the visitor came from a
  protected page; locale prefix when not English). Tokens are 32 random bytes; only their
  SHA-256 is stored (`soiguru_magic_links`). A link works once and for 20 minutes; using one
  closes the address's other open links. The landing page
  (`components/soiguru/magic-link-landing.tsx`) signs in with `signIn('magic-link')` from the
  browser (the same callback route the password form uses, so the session cookie sticks) and
  then goes to `callbackUrl`, else `/client/dashboard` or `/admin`. A used or expired link shows
  "This sign-in link no longer works" with a button back to sign in.
- **Provider.** `lib/auth/magic-link-provider.ts`, a credentials-style NextAuth provider (id
  `magic-link`) registered next to the password provider. Its `authorize` is the only place a
  link session is minted; it consumes the token in one conditional `UPDATE … RETURNING`.
- **Throttle.** Per address in the database: 3 links per 15 minutes, at least 30 seconds apart.
  Per IP in memory: 10 requests per 15 minutes. If no mail provider is configured the form says
  so and points to the password.
- **Check your inbox.** After sending, the card shows the address and a button that opens the
  visitor's webmail, searched for our sender where the webmail supports it
  (`lib/soiguru/mailbox-links.ts`, unit-tested):

  | Domains | Opens |
  | --- | --- |
  | gmail.com, googlemail.com | Gmail search `from:<sender> in:anywhere newer_than:1h` |
  | outlook.\*, hotmail.\*, live.\*, msn.com | Outlook.com inbox (no search deep link exists) |
  | yahoo.\*, ymail.com, rocketmail.com | Yahoo Mail search for the sender |
  | icloud.com, me.com, mac.com | iCloud Mail |
  | proton.me, protonmail.com, protonmail.ch, pm.me | Proton all-mail search for the sender |

  Any other domain gets "Open your email app and look for the email from SoiGuru". The sender
  is the configured From address (`EMAIL_FROM`, or `mail.default_from` in the content config).
  "Send a new link" and "Use a different email" sit under it. Strings are in
  `soiguru.account.magic*` (English and Thai).

### Branded emails

- **One frame** for every SoiGuru transactional email (`lib/soiguru/emails/render.ts`): ground
  `#f4f5f2`, a 600px fluid column, the SoiGuru logo (PNG at
  `https://owner.soiguru.com/brand/email-logo-horizontal-88.png`; Outlook shows neither WebP nor
  SVG), a white card with the sea top border, a bulletproof button (padded link with Outlook
  `mso-` spacing, fully clickable in Outlook desktop), a hidden preview line, a footer that says
  why the reader got the email, the support address and the site, and a sea/sun rule. Tables
  and inline styles only; light colour scheme declared so Apple Mail does not invert it. Every
  message has a plain-text part generated from the same body.
- **Templates** (`lib/soiguru/emails/templates.ts`): sign-in link, confirm email address,
  reset password, two-step sign-in code. The last three replace the template's own emails in
  `lib/mail/index.ts` (`sendVerificationEmailWithTemplate`, `sendPasswordResetEmail`,
  `sendTwoFactorTokenEmail`); the old emails stay in the code as the fallback when rendering
  fails. There are no claim approved/rejected emails yet, so none were branded.
- **Placeholders** are `{{name}}`, `{{email}}`, `{{link}}`, `{{expires}}`, `{{code}}` (per
  template). Values are HTML-escaped in the HTML part; `{{link}}` only accepts http(s);
  line breaks are stripped from the subject. `{{button:Label}}` renders the button to
  `{{link}}`. Body tags without a `style` (`h1`, `h2`, `p`, `a`, lists, `strong`, `hr`, and
  `p.muted` / `p.code`) get the brand's inline styles.

### Admin → Emails

- `/admin/emails` (in the admin nav after Reports; `components/admin/emails/`). Left: the four
  templates, marked Default or Edited (and "Unsaved changes"). Middle: subject, preview text and
  the HTML body, with the template's placeholders as chips that insert at the cursor, a list of
  what each means, and a warning for unknown placeholders. Right: the inbox line (subject and
  preview) and the email rendered with sample values in a sandboxed iframe (`sandbox=""`), as
  Desktop, Phone (375px) or Plain text.
- **Save** stores the override; new emails use it at once. **Reset to default** deletes it.
  **Send test email to me** sends the current draft, saved or not, to the signed-in admin with
  "[Test]" before the subject (10 per 10 minutes).
- **Storage.** A new table `soiguru_email_templates` (one row per edited template: subject,
  preheader, body, who, when), migration `0046_soiguru_magic_link_emails.sql`, which also adds
  `soiguru_magic_links`. A table rather than the content repo or the template's settings store:
  edits are admin data that must take effect without a rebuild, need an audit field, and the
  existing settings store is file-based config. Reads fail soft: without the table every email
  uses its default. API: `GET /api/admin/email-templates`, `PUT|DELETE
  /api/admin/email-templates/:id`, `POST /api/admin/email-templates/:id/test`, all behind
  `requireAdminSession` (live DB role check).

## Deploy

- Migration `0046` runs on start (`lib/db/initialize.ts` runs pending migrations).
- Env (names only): `EMAIL_PROVIDER=smtp` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASSWORD` (Amazon SES SMTP credentials), `EMAIL_FROM` (an SES-verified sender; also the
  Gmail/Yahoo/Proton search term). Optional `SOIGURU_EMAIL_LOGO_URL` to serve the logo from
  another https host.

## Not covered / open

- **Mail scanners.** The link is spent by a POST from the landing page's script, not by
  opening the URL, so plain link-fetching scanners do not use it up. Scanners that run the
  page's JavaScript (some corporate Outlook setups) could; if owners report dead links, make
  the landing page wait for a "Sign in" tap.
- Sign-in links also work for admins and skip email two-step codes (both prove the same
  mailbox, like a password reset does).
- The link form has no reCAPTCHA (the template checks captcha in the browser only); the
  throttles above stand in.
- An account created by link has no password. "Forgot password?" sets `users.password_hash`,
  but client password sign-in reads `accounts`, so it cannot add one (same as for OAuth users
  today).
- Emails are English only. No postal address in the footer (none is published).
- Outlook.com has no search deep link; the button opens the inbox.
