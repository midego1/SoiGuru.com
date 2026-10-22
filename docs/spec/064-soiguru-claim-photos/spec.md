# 064 — Photos while claiming: shop front, inside, menu (SoiGuru)

Status: implemented

## Problem

A claimed listing without the owner's own photos still shows Google photos, and owners rarely
come back to add photos later. The moment they are most motivated is during the claim. A photo
of the shop front is also good evidence for the admin that the claimant was at the shop.

## Behaviour

- The claim flow has four steps: find your business → verify it's you → **your photos** →
  choose a plan. The photo step has three slots, each with a tip and an example drawing
  (`components/soiguru/photo-examples.tsx`):
  1. Shop front, required: daylight, straight on, the sign readable, nothing parked in front.
  2. Inside, recommended: from the door, lights on, tidy, the room rather than one table.
  3. Menu or services, optional: the board, a price list or what you sell, readable.
  "Take a photo or upload" opens the camera or the photo library on a phone; the browser
  shrinks the photo (1600 px, WebP or JPEG, spec 061) and posts it. Continue opens once the shop
  front is in. A photo of the same kind replaces the earlier one ("Retake").
- `POST /api/soiguru/claim/photos` (multipart `city`, `listing`, `kind`, `photo`), signed-in
  users, listing must exist, same checks as owner photos (signature, 3 MB). Stored in
  `soiguru_claim_photos` (migration 0045): one row per user, listing and kind, bytes in the
  database so a redeploy does not lose them. `GET /api/soiguru/claim/photos/<id>` serves a photo
  to its claimant or an admin only.
- The review screen shows the claimant's photos under the claim facts.
- On approval the photos are written into the content repo (spec 061) in slot order and
  become the listing's first photos, ahead of any existing ones; the rows are deleted. On
  rejection the rows are deleted.
- The dashboard Photos screen shows the same three tips and drawings while the listing has
  fewer than three photos.
- English and Thai.

## Not covered

Photos are not checked automatically for content; the admin sees them before approval. The
drawings stand in for example photos; real example photos can replace them later.
