/**
 * Owner photos come in three sizes (owner app, spec 067): `<id>.webp` (up to 1600px),
 * `<id>-800.webp` (800×600, cards) and `<id>-400.webp` (400×300, thumbnails). A listing's
 * `images` holds the main URLs; the smaller copy is the same URL with the suffix. Other image
 * URLs (older uploads, external photos) are returned unchanged.
 */

const OWN_PHOTO = /^(https:\/\/[^/]+\/media\/[a-z0-9-]{1,120}\/[a-z0-9]{6,40})\.webp$/;

/** The 800×600 or 400×300 copy of an owner photo, or the URL itself when it has none. */
export function photoVariant(url: string, size: 800 | 400): string {
    const m = OWN_PHOTO.exec(url);
    return m ? `${m[1]}-${size}.webp` : url;
}
