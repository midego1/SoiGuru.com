'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import {
	createClaim,
	decideClaim,
	getApprovedClaim,
	saveListingFields,
	userIsAdmin,
	type ClaimPayment,
	type ClaimPlan,
	type ClaimVerification
} from '@/lib/soiguru/claims';
import { getCategories, getCityListings } from '@/lib/soiguru/content';
import { addSaved, removeSaved } from '@/lib/soiguru/saved';
import { deletePhotoFile } from '@/lib/soiguru/photos';
import { WEEKDAYS } from '@/lib/soiguru/types';
import { menuFromForm } from '@/lib/soiguru/menu';

/**
 * Server actions for the SoiGuru claim flow and owner dashboard (spec 054).
 * Every form posts here without client script; each action re-checks the
 * session and the user's right to the listing before writing anything.
 */

const str = (fd: FormData, key: string, max = 300) => {
	const v = fd.get(key);
	return typeof v === 'string' ? v.trim().slice(0, max) : '';
};

const prefixOf = (locale: string) => (locale && locale !== 'en' ? `/${locale}` : '');

async function requireUser(locale: string, back: string) {
	const session = await auth();
	const id = session?.user?.id;
	if (!id) redirect(`${prefixOf(locale)}/auth/signin?callbackUrl=${encodeURIComponent(back)}`);
	return { id, email: session.user?.email ?? '' };
}

/** Owner (approved claim) or admin for this listing, else back to /owner. */
async function requireEditor(locale: string, city: string, slug: string) {
	const user = await requireUser(locale, `${prefixOf(locale)}/owner`);
	const ok = (await getApprovedClaim(user.id, city, slug)) || (await userIsAdmin(user.id));
	if (!ok) redirect(`${prefixOf(locale)}/owner`);
	const listing = (await getCityListings(city)).find((l) => l.slug === slug);
	if (!listing) redirect(`${prefixOf(locale)}/owner`);
	return { user, listing };
}

function refresh(locale: string, city: string, area: string, slug: string) {
	const p = prefixOf(locale);
	for (const path of [`${p}/${city}`, `${p}/${city}/${area}/${slug}`, `${p}/owner`]) revalidatePath(path);
}

/* ── Claim flow ─────────────────────────────────────────────────────────── */

export async function submitClaim(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const p = prefixOf(locale);
	const user = await requireUser(locale, `${p}/${city}/claim?listing=${slug}&step=2`);
	const listing = (await getCityListings(city)).find((l) => l.slug === slug);
	if (!listing) redirect(`${p}/${city}/claim`);

	const verification: ClaimVerification = str(formData, 'verify') === 'sign' ? 'sign' : 'call';
	const plan: ClaimPlan = str(formData, 'plan') === 'monthly' ? 'monthly' : 'yearly';
	const paymentMethod: ClaimPayment = str(formData, 'pay') === 'card' ? 'card' : 'promptpay';
	try {
		await createClaim({
			userId: user.id,
			city,
			listingSlug: slug,
			verification,
			contactPhone: str(formData, 'phone', 30),
			note: str(formData, 'note', 500),
			plan,
			paymentMethod
		});
	} catch (error) {
		if (error instanceof Error && error.message === 'already-claimed') {
			redirect(`${p}/${city}/claim?listing=${slug}&step=1&taken=1`);
		}
		throw error;
	}
	revalidatePath(`${p}/owner`);
	redirect(`${p}/owner?claimed=${encodeURIComponent(slug)}`);
}

/* ── Saved ──────────────────────────────────────────────────────────────── */

/** Heart on the listing page: save the place and open the Saved tab. */
export async function saveListing(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const p = prefixOf(locale);
	const listing = (await getCityListings(city)).find((l) => l.slug === slug);
	if (!listing) redirect(`${p}/saved?city=${encodeURIComponent(city)}`);
	const back = `${p}/${city}/${listing.area}/${slug}`;
	const user = await requireUser(locale, back);
	await addSaved(user.id, listing);
	revalidatePath(`${p}/saved`);
	redirect(`${p}/saved?city=${encodeURIComponent(city)}&added=${encodeURIComponent(slug)}`);
}

export async function unsaveListing(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const p = prefixOf(locale);
	const user = await requireUser(locale, `${p}/saved`);
	await removeSaved(user.id, str(formData, 'listing', 120));
	revalidatePath(`${p}/saved`);
	redirect(`${p}/saved?city=${encodeURIComponent(city)}`);
}

/* ── Owner dashboard ────────────────────────────────────────────────────── */

const phoneE164 = (raw: string) => {
	const digits = raw.replace(/[^\d]/g, '');
	if (!digits) return undefined;
	if (raw.trim().startsWith('+')) return `+${digits}`;
	return `+66${digits.replace(/^0/, '')}`;
};

export async function saveDetails(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const { listing } = await requireEditor(locale, city, slug);
	const categories = await getCategories();
	const category = str(formData, 'category', 60);
	const name = str(formData, 'name', 120) || listing.name;
	const line = str(formData, 'line_id', 60).replace(/^@+/, '');

	await saveListingFields(
		slug,
		{
			name,
			name_th: str(formData, 'name_th', 120) || undefined,
			description: str(formData, 'description', 300) || undefined,
			description_th: str(formData, 'description_th', 300) || undefined,
			category: categories.some((c) => c.id === category) ? category : listing.category.id,
			phone: phoneE164(str(formData, 'phone', 30)),
			line_id: line ? `@${line}` : undefined,
			whatsapp: phoneE164(str(formData, 'whatsapp', 30)),
			address: str(formData, 'address', 200) || undefined,
			booking_note: str(formData, 'booking_note', 160) || undefined
		},
		`Owner edit (details): ${city}/${slug}`
	);
	refresh(locale, city, listing.area, slug);
	redirect(`${prefixOf(locale)}/owner/${city}/${slug}/details?saved=1`);
}

/* ── Owner photos (spec 061) ────────────────────────────────────────────── */

/** Remove one photo from the listing (and its file, when it is an owner photo). */
export async function removePhoto(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const url = str(formData, 'url', 400);
	const { listing } = await requireEditor(locale, city, slug);
	if (listing.images.includes(url)) {
		await deletePhotoFile(slug, url);
		await saveListingFields(
			slug,
			{ images: listing.images.filter((u) => u !== url) },
			`Owner photos: ${city}/${slug} (removed one)`
		);
		refresh(locale, city, listing.area, slug);
	}
	redirect(`${prefixOf(locale)}/owner/${city}/${slug}/photos?saved=1`);
}

/** Make a photo the first one (the big photo on the listing and the card photo). */
export async function coverPhoto(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const url = str(formData, 'url', 400);
	const { listing } = await requireEditor(locale, city, slug);
	if (listing.images.includes(url) && listing.images[0] !== url) {
		await saveListingFields(
			slug,
			{ images: [url, ...listing.images.filter((u) => u !== url)] },
			`Owner photos: ${city}/${slug} (new cover)`
		);
		refresh(locale, city, listing.area, slug);
	}
	redirect(`${prefixOf(locale)}/owner/${city}/${slug}/photos?saved=1`);
}

const TIME = /^([01]\d|2[0-4]):[0-5]\d$/;

export async function saveHours(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const { listing } = await requireEditor(locale, city, slug);
	const copyMon = str(formData, 'copy') === 'mon';

	const rangesFor = (day: string): string[] => {
		if (formData.get(`${day}_open`) !== 'on') return [];
		const out: string[] = [];
		for (const n of ['1', '2']) {
			const from = str(formData, `${day}_from${n}`, 5);
			const rawTo = str(formData, `${day}_to${n}`, 5);
			const to = rawTo === '23:59' ? '24:00' : rawTo;
			if (TIME.test(from) && TIME.test(to))
				out.push(from === '00:00' && to === '24:00' ? '00:00-24:00' : `${from}-${to}`);
		}
		return out;
	};

	const hours: Record<string, string[]> = {};
	const mon = rangesFor('mon');
	for (const day of WEEKDAYS) hours[day] = copyMon ? [...mon] : rangesFor(day);

	await saveListingFields(
		slug,
		{ hours, hours_note: str(formData, 'hours_note', 160) || undefined },
		`Owner edit (hours): ${city}/${slug}`
	);
	refresh(locale, city, listing.area, slug);
	redirect(`${prefixOf(locale)}/owner/${city}/${slug}/hours?saved=1`);
}

/** Menu & prices (spec 069): sections and rows from the form; empty rows are dropped. */
export async function saveMenu(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const { listing } = await requireEditor(locale, city, slug);
	const get = (key: string) => (formData.has(key) ? str(formData, key, 120) : undefined);
	const on = (key: string) => formData.get(key) === 'on';
	const menu = menuFromForm(get, on);
	// YAML-friendly plain objects without undefined keys.
	const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
	const sections = menu.map((s) => clean({ title: s.title, title_th: s.title_th, items: s.items.map((i) => clean({ ...i })) }));
	await saveListingFields(
		slug,
		{
			menu: sections.length ? sections : undefined,
			menu_note: str(formData, 'menu_note', 160) || undefined,
			menu_note_th: str(formData, 'menu_note_th', 160) || undefined
		},
		`Owner edit (menu): ${city}/${slug}`
	);
	refresh(locale, city, listing.area, slug);
	redirect(`${prefixOf(locale)}/owner/${city}/${slug}/menu?saved=1`);
}

export async function saveAmenities(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const city = str(formData, 'city', 40);
	const slug = str(formData, 'listing', 120);
	const { listing } = await requireEditor(locale, city, slug);
	const amenities: Record<string, boolean> = {};
	for (const [key, value] of formData.entries()) {
		if (!key.startsWith('amenity_') || typeof value !== 'string') continue;
		const id = key.slice('amenity_'.length);
		if (!/^[a-z0-9-]+$/.test(id)) continue;
		if (value === 'yes') amenities[id] = true;
		else if (value === 'no') amenities[id] = false;
	}
	await saveListingFields(
		slug,
		{ amenities: Object.keys(amenities).length ? amenities : undefined },
		`Owner edit (good to know): ${city}/${slug}`
	);
	refresh(locale, city, listing.area, slug);
	redirect(`${prefixOf(locale)}/owner/${city}/${slug}/amenities?saved=1`);
}

/* ── Admin review ───────────────────────────────────────────────────────── */

export async function reviewClaim(formData: FormData) {
	const locale = str(formData, 'locale', 5);
	const user = await requireUser(locale, `${prefixOf(locale)}/owner/review`);
	if (!(await userIsAdmin(user.id))) redirect(`${prefixOf(locale)}/owner`);
	const id = str(formData, 'id', 64);
	const approve = str(formData, 'decision') === 'approve';
	await decideClaim(id, user.id, approve, str(formData, 'review_note', 300));
	revalidatePath(`${prefixOf(locale)}/owner/review`);
	redirect(`${prefixOf(locale)}/owner/review?done=${approve ? 'approved' : 'rejected'}`);
}
