import { createHmac, timingSafeEqual } from 'node:crypto';
import { takeMonthly } from '@/lib/soiguru/places-usage';

/**
 * Google Places photos for SoiGuru listings (spec 056).
 *
 * The public site (soiguru.com, static) shows Google photos as a fallback when a listing has no
 * photos of its own. Google's terms allow storing a place ID but not the photos or photo names,
 * so photos are looked up live: the listing is matched to a Google place once (place ID kept in
 * memory), its photo list is read on each request, and each photo is served through a signed
 * redirect to Google's short-lived photo URL. The API key stays on this server.
 */

const API = 'https://places.googleapis.com/v1';
const MAX_PHOTOS = 3;
/** A match must be this close to the listing's coordinates (metres). */
const MAX_DISTANCE_M = 400;

export interface PlacePhoto {
	/** Signed path on this server that redirects to the photo */
	url: string;
	width: number;
	height: number;
	author?: string;
	authorUri?: string;
}

interface Listing {
	name: string;
	lat?: number;
	lng?: number;
	area?: string;
	city?: string;
	/** Google place ID stored with the listing (`google_place_id` in the content repo); skips the search. */
	placeId?: string;
}

/**
 * Daily budget of Google calls (search, details, photo media), so a busy page cannot run up
 * the bill: `PLACES_DAILY_LIMIT` (default 4000). Over the limit the routes return no photos
 * and the site keeps its drawings until the next day (UTC).
 */
const DAILY_LIMIT = Math.max(0, Number(process.env.PLACES_DAILY_LIMIT) || 4000);
let budgetDay = '';
let budgetUsed = 0;

/** Count one Google call; false when today's budget is spent. */
export function takeBudget(): boolean {
	const today = new Date().toISOString().slice(0, 10);
	if (today !== budgetDay) {
		budgetDay = today;
		budgetUsed = 0;
	}
	if (budgetUsed >= DAILY_LIMIT) return false;
	budgetUsed += 1;
	return true;
}

const placeIds = new Map<string, string | null>();

/** The fields of a content-repo listing the lookup needs (`geo` or `location`, `google_place_id`). */
export function placesListing(meta: Record<string, unknown> & { name: string }): Listing {
	const geo = meta.geo as { lat?: number; lng?: number } | undefined;
	const loc = meta.location as { latitude?: number; longitude?: number } | undefined;
	return {
		name: meta.name,
		lat: geo?.lat ?? loc?.latitude,
		lng: geo?.lng ?? loc?.longitude,
		area: typeof meta.area === 'string' ? meta.area : undefined,
		city: typeof meta.city === 'string' ? meta.city : undefined,
		placeId: typeof meta.google_place_id === 'string' ? meta.google_place_id : undefined
	};
}

export function placesKey(): string | undefined {
	const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
	return key ? key : undefined;
}

function secret(): string {
	return process.env.AUTH_SECRET || process.env.CRON_SECRET || 'soiguru-places';
}

/** HMAC of a photo name, so the redirect route serves only photos this server listed. */
export function signPhoto(name: string): string {
	return createHmac('sha256', secret()).update(name).digest('base64url').slice(0, 32);
}

export function verifyPhoto(name: string, sig: string): boolean {
	const expected = Buffer.from(signPhoto(name));
	const given = Buffer.from(sig || '');
	return expected.length === given.length && timingSafeEqual(expected, given);
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
	const r = 6371000;
	const dLat = ((bLat - aLat) * Math.PI) / 180;
	const dLng = ((bLng - aLng) * Math.PI) / 180;
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
	return 2 * r * Math.asin(Math.sqrt(s));
}

/** Google place ID for a listing (cached in memory; `null` = no confident match). */
export async function findPlaceId(slug: string, listing: Listing, key: string): Promise<string | null> {
	if (listing.placeId && /^[\w-]{10,300}$/.test(listing.placeId)) return listing.placeId;
	if (placeIds.has(slug)) return placeIds.get(slug) ?? null;
	// Text Search Pro is billable: only inside the free monthly usage (spec 060).
	if (!takeBudget() || !(await takeMonthly('search'))) return null;
	const hasGeo = typeof listing.lat === 'number' && typeof listing.lng === 'number';
	const where = [listing.area?.replace(/-/g, ' '), listing.city ?? 'Krabi', 'Thailand'].filter(Boolean).join(', ');
	const body: Record<string, unknown> = { textQuery: `${listing.name}, ${where}`, maxResultCount: 3 };
	if (hasGeo)
		body.locationBias = { circle: { center: { latitude: listing.lat, longitude: listing.lng }, radius: 500 } };
	const res = await fetch(`${API}/places:searchText`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Goog-Api-Key': key,
			'X-Goog-FieldMask': 'places.id,places.location'
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`Places search failed: ${res.status}`);
	const data = (await res.json()) as {
		places?: { id: string; location?: { latitude: number; longitude: number } }[];
	};
	const match = (data.places ?? []).find(
		(p) =>
			!hasGeo ||
			(p.location &&
				distanceM(listing.lat!, listing.lng!, p.location.latitude, p.location.longitude) <= MAX_DISTANCE_M)
	);
	const id = match?.id ?? null;
	placeIds.set(slug, id);
	return id;
}

/** Up to three Google photos for a listing, newest list on each call. */
export async function listingPhotos(slug: string, listing: Listing, max = MAX_PHOTOS): Promise<PlacePhoto[]> {
	return (await listingPlace(slug, listing, max)).photos;
}

/** The listing's Google place ID and up to `max` photos. */
export async function listingPlace(
	slug: string,
	listing: Listing,
	max = MAX_PHOTOS
): Promise<{ placeId: string | null; photos: PlacePhoto[] }> {
	const key = placesKey();
	if (!key) return { placeId: null, photos: [] };
	const id = await findPlaceId(slug, listing, key);
	if (!id) return { placeId: null, photos: [] };
	if (!takeBudget()) return { placeId: id, photos: [] };
	const res = await fetch(`${API}/places/${encodeURIComponent(id)}`, {
		headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'photos' }
	});
	if (!res.ok) throw new Error(`Place details failed: ${res.status}`);
	const data = (await res.json()) as {
		photos?: {
			name: string;
			widthPx: number;
			heightPx: number;
			authorAttributions?: { displayName?: string; uri?: string }[];
		}[];
	};
	const photos = (data.photos ?? []).slice(0, max).map((p) => ({
		url: `/api/places/photo?name=${encodeURIComponent(p.name)}&sig=${signPhoto(p.name)}`,
		width: p.widthPx,
		height: p.heightPx,
		author: p.authorAttributions?.[0]?.displayName,
		authorUri: p.authorAttributions?.[0]?.uri
	}));
	return { placeId: id, photos };
}

/** Google's short-lived URL for one photo. */
export async function photoUri(name: string, maxWidth: number): Promise<string | null> {
	const key = placesKey();
	if (!key) return null;
	// Place Details Photos is billable: only inside the free monthly usage (spec 060).
	if (!takeBudget() || !(await takeMonthly('photo'))) return null;
	const res = await fetch(`${API}/${name}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true`, {
		headers: { 'X-Goog-Api-Key': key }
	});
	if (!res.ok) return null;
	const data = (await res.json()) as { photoUri?: string };
	return data.photoUri ?? null;
}
