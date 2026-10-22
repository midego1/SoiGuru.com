# 063 — "For business owners" page (SoiGuru)

Status: implemented

## Problem

Owners who land on a listing see a claim card and a price, but nowhere on soiguru.com explains
what SoiGuru is, why a claimed listing helps them, how the claim is checked and paid, and what
they can manage afterwards. Owners are mostly Thai; the explanation must exist in Thai too.

## Behaviour

- `/for-owners` (English) and `/th/for-owners` (Thai, from the same source via `data-th`):
  1. Hero: your shop is already on SoiGuru; what SoiGuru is; Claim and See-your-shop buttons.
  2. Why it matters: found on Google, open now, two languages.
  3. What claiming gives you: hours and holiday notices, own photos (8), LINE/WhatsApp, Thai
     name, amenities, Verified badge, changes live within minutes; price card ฿100 / month
     or ฿1,000 / year, listing itself free.
  4. How to claim, six steps with phone screenshots of the real screens: the claim card on a
     listing, the claim search, the sign-in screen, the verification step (we call the number
     on the listing, or shop sign + ID by email), the photo step (shop front, inside, menu;
     spec 064), the plan step (nothing charged now; PromptPay QR or card link by email after
     confirmation).
  5. The dashboard: screenshots of the owner dashboard, the hours screen and the photos screen.
  6. Questions: free listing, someone else claimed it, how fast changes show, cancelling,
     personal details, where to sign in.
  7. Closing call to action.
- Screenshots live in `src/assets/for-owners/` and go through `astro:assets` (resized WebP).
  They were taken at phone size (390 px, 2×) from soiguru.com and the owner app, in English
  and in Thai (`-th` files); the page shows the set of its language (`sg-lang-en` / `sg-lang-th`).
- The five steps and the three dashboard screens are cards of one shape (text, then the top of
  the screen cropped to 4:5), three per row on desktop, two on tablets, one on phones.
- Linked from the footer ("For business owners") and from the claim card on listing pages
  ("How claiming works and what you get").
- Indexed (it answers "SoiGuru claim" searches) and in the sitemap like every SoiGuru page.

## Not covered

Contact details for owners whose shop is not listed yet; the page points to the claim search,
which covers the shops already in the data. A contact channel for new listings is a separate
decision (docs/questions.md).
