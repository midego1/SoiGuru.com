# 065 — Privacy policy and terms of use (SoiGuru)

Status: implemented

## Problem

Owners give SoiGuru an email, a phone number and photos, and will pay for a plan. Thailand's
PDPA and plain fairness need a privacy policy, and the paid plan needs terms (what is bought,
refunds, what we may remove). The site had only an About page.

## Behaviour

- `/privacy` and `/th/privacy`: who runs SoiGuru and the contact address; visitors (no account,
  saved places on the device, location in the browser only, cookieless self-hosted analytics,
  Google and OpenStreetMap as third parties); owners (email, hashed password, claim details,
  photos private until approval, public edits, payment record without card data), purpose,
  retention (account lifetime; payment records five years; deletion within 30 days); business
  information on listings and how to correct or remove it; processors; PDPA rights; changes.
- `/terms` and `/th/terms`: what SoiGuru is and is not; using the site; owner accounts;
  claiming (who may, verification, refusal, ownership change); owner content (licence, own
  photos only, true information, removal); the owner plan (free listing, prices, manual
  payment after confirmation, no automatic charges, monthly cancel, yearly refund within 14
  days, lapse); unclaimed businesses; liability; Thai law; contact.
- English with Thai on every text, like every SoiGuru page. Linked from the footer's legal row.
- Contact address on both pages: support@soiguru.com.

## Not covered

The legal entity's name and address are not on the pages yet; add them once decided. Prices and
refund rules mirror the claim flow (spec 054); change both together.
