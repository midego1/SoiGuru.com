import { cityNow, parseDayHours, parseWeeklyHours } from './hours';
import { menuFromForm, parseMenu, type MenuSection } from './menu';
import { WEEKDAYS, type Listing, type TimeRange, type Weekday, type WeeklyHours } from './types';

/**
 * Live preview of an edit page (spec 074): the listing as visitors see it, fed by the form's
 * current, unsaved values. Pure and client-safe: the owner pages build a `PreviewListing` from
 * the saved listing on the server, and the browser overlays the form fields on it with the same
 * rules the save actions use (`app/[locale]/(soiguru)/actions.ts`), so the preview shows what a
 * save would publish.
 */

export interface PreviewCategory {
	id: string;
	name: string;
	name_th?: string;
}

export interface PreviewAmenity {
	id: string;
	name: string;
	name_th?: string;
	available: boolean;
}

/** Plain, serialisable listing data the preview renders (no dates, no functions). */
export interface PreviewListing {
	name: string;
	nameTh?: string;
	description?: string;
	descriptionTh?: string;
	category: PreviewCategory;
	areaName?: string;
	address?: string;
	phone?: string;
	lineId?: string;
	whatsapp?: string;
	/** Directions shows when the listing has a map point. */
	hasGeo: boolean;
	bookingNote?: string;
	hours: WeeklyHours;
	hoursNote?: string;
	amenities: PreviewAmenity[];
	menu: MenuSection[];
	menuNote?: string;
	menuNoteTh?: string;
	images: string[];
	claimed: boolean;
	rating?: number;
	ratingCount?: number;
	priceBand?: number;
}

/** Amenity names by id, as `amenities.yml` gives them. */
export type AmenityNames = Record<string, { name: string; name_th?: string }>;

/** Readable fallback for an amenity id that `amenities.yml` doesn't know ("free-wifi" → "Free wifi"). */
export function amenityFallbackName(id: string): string {
	const text = id.replace(/-/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function amenity(id: string, available: boolean, names: AmenityNames): PreviewAmenity {
	const a = names[id];
	return { id, available, name: a?.name ?? amenityFallbackName(id), name_th: a?.name_th };
}

/** The saved listing as preview data (server side). */
export function previewFromListing(
	l: Listing,
	opts: { areaName?: string; amenityNames?: AmenityNames } = {}
): PreviewListing {
	const names = opts.amenityNames ?? {};
	return {
		name: l.name,
		nameTh: l.nameTh,
		description: l.description,
		descriptionTh: l.descriptionTh,
		category: { id: l.category.id, name: l.category.name, name_th: l.category.name_th },
		areaName: opts.areaName,
		address: l.address,
		phone: l.phone,
		lineId: l.lineId,
		whatsapp: l.whatsapp,
		hasGeo: !!l.geo,
		bookingNote: l.bookingNote,
		hours: l.hours,
		hoursNote: l.hoursNote,
		amenities: l.amenities.map((a) => amenity(a.id, a.available, names)),
		menu: l.menu,
		menuNote: l.menuNote,
		menuNoteTh: l.menuNoteTh,
		images: l.images,
		claimed: l.claimed,
		rating: l.rating,
		ratingCount: l.ratingCount,
		priceBand: l.priceBand
	};
}

/** Form fields in document order; files are left out. */
export type FormEntries = Array<[string, string]>;

/** `FormData` → entries, without file inputs. */
export function formEntries(fd: { forEach(cb: (value: unknown, key: string) => void): void }): FormEntries {
	const out: FormEntries = [];
	fd.forEach((value, key) => {
		if (typeof value === 'string') out.push([key, value]);
	});
	return out;
}

/** True when the form differs from the snapshot taken when the page loaded. */
export function isDirty(initial: FormEntries, current: FormEntries): boolean {
	if (initial.length !== current.length) return true;
	return initial.some(([k, v], i) => current[i][0] !== k || current[i][1] !== v);
}

/** Same rule as the save action: "0812345678" or "812345678" → "+66812345678"; "+..." kept. */
export function phoneE164(raw: string): string | undefined {
	const digits = raw.replace(/[^\d]/g, '');
	if (!digits) return undefined;
	if (raw.trim().startsWith('+')) return `+${digits}`;
	return `+66${digits.replace(/^0/, '')}`;
}

const TIME = /^([01]\d|2[0-4]):[0-5]\d$/;

/**
 * One day of the hours form (`<day>_open`, `<day>_from1`, `<day>_to1`, `<day>_from2`,
 * `<day>_to2`), read like `saveHours` does: off = closed, 23:59 = 24:00, half-filled ranges dropped.
 */
export function dayFromForm(get: (key: string) => string | undefined, day: Weekday): TimeRange[] {
	if (get(`${day}_open`) !== 'on') return [];
	const out: string[] = [];
	for (const n of ['1', '2']) {
		const from = (get(`${day}_from${n}`) ?? '').trim().slice(0, 5);
		const rawTo = (get(`${day}_to${n}`) ?? '').trim().slice(0, 5);
		const to = rawTo === '23:59' ? '24:00' : rawTo;
		if (TIME.test(from) && TIME.test(to)) out.push(`${from}-${to}`);
	}
	return parseDayHours(out) ?? [];
}

const clip = (v: string | undefined, max: number) => (v === undefined ? undefined : v.trim().slice(0, max));
const orUndefined = (v: string | undefined) => (v ? v : undefined);

/**
 * Overlays the edit form on the saved listing. Only the fields the form has are applied, so one
 * function serves every edit page (details, hours, good to know, menu). Mirrors the save actions.
 */
export function applyFormToPreview(
	base: PreviewListing,
	entries: FormEntries,
	opts: { categories?: PreviewCategory[]; amenityNames?: AmenityNames } = {}
): PreviewListing {
	const map = new Map<string, string>();
	for (const [k, v] of entries) if (!map.has(k)) map.set(k, v);
	const has = (k: string) => map.has(k);
	const get = (k: string) => map.get(k);
	const next: PreviewListing = { ...base };

	// Details
	if (has('name')) next.name = clip(get('name'), 120) || base.name;
	if (has('name_th')) next.nameTh = orUndefined(clip(get('name_th'), 120));
	if (has('description')) next.description = orUndefined(clip(get('description'), 300));
	if (has('description_th')) next.descriptionTh = orUndefined(clip(get('description_th'), 300));
	if (has('category')) {
		const found = opts.categories?.find((c) => c.id === get('category'));
		if (found) next.category = found;
	}
	if (has('phone')) next.phone = phoneE164(clip(get('phone'), 30) ?? '');
	if (has('line_id')) {
		const line = (clip(get('line_id'), 60) ?? '').replace(/^@+/, '');
		next.lineId = line ? `@${line}` : undefined;
	}
	if (has('whatsapp')) next.whatsapp = phoneE164(clip(get('whatsapp'), 30) ?? '');
	if (has('address')) next.address = orUndefined(clip(get('address'), 200));
	if (has('booking_note')) next.bookingNote = orUndefined(clip(get('booking_note'), 160));

	// Hours
	if (has('mon_from1')) {
		const hours = {} as WeeklyHours;
		for (const d of WEEKDAYS) hours[d] = dayFromForm(get, d);
		next.hours = hours;
	}
	if (has('hours_note')) next.hoursNote = orUndefined(clip(get('hours_note'), 160));

	// Good to know: the radio groups in page order; "Not set" leaves the amenity out.
	if (entries.some(([k]) => k.startsWith('amenity_'))) {
		const names = { ...Object.fromEntries(base.amenities.map((a) => [a.id, a])), ...(opts.amenityNames ?? {}) };
		next.amenities = entries
			.filter(([k, v]) => k.startsWith('amenity_') && (v === 'yes' || v === 'no'))
			.map(([k, v]) => amenity(k.slice('amenity_'.length), v === 'yes', names))
			.filter((a) => /^[a-z0-9-]+$/.test(a.id));
	}

	// Menu & prices: the menu page always has the note field, even with no rows.
	if (has('menu_note')) {
		next.menu = menuFromForm(
			(k) => (has(k) ? clip(get(k), 120) : undefined),
			(k) => get(k) === 'on'
		);
		next.menuNote = orUndefined(clip(get('menu_note'), 160));
		next.menuNoteTh = orUndefined(clip(get('menu_note_th'), 160));
	}
	return next;
}

/** True when some day has hours set (open or closed); otherwise the hours are "not confirmed". */
export function hasAnyHours(hours: WeeklyHours): boolean {
	return WEEKDAYS.some((d) => hours[d] !== null);
}

export interface PreviewHoursRow {
	day: Weekday;
	ranges: TimeRange[] | null;
	today: boolean;
}

/** The public page's hours table: every day on its own row, today first (Bangkok time). */
export function previewHoursRows(hours: WeeklyHours, now: Date = new Date()): PreviewHoursRow[] {
	const { day } = cityNow(now);
	const idx = WEEKDAYS.indexOf(day);
	return WEEKDAYS.map((_, i) => {
		const d = WEEKDAYS[(idx + i) % 7];
		return { day: d, ranges: hours[d], today: i === 0 };
	});
}

/**
 * An admin item (spec 070) as preview data: the item editor's current fields over the raw
 * content item, whose SoiGuru keys (hours, menu, photos, …) the editor doesn't edit.
 */
export function previewFromItem(
	raw: Record<string, unknown>,
	edited: { name: string; description: string; category: string[]; address?: string },
	opts: { categories?: PreviewCategory[]; amenityNames?: AmenityNames; areaName?: string } = {}
): PreviewListing {
	const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
	const n = (v: unknown) => {
		const x = typeof v === 'string' ? Number(v) : v;
		return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
	};
	const catId = edited.category[0] ?? '';
	const category = opts.categories?.find((c) => c.id === catId) ?? {
		id: catId || 'other',
		name: catId ? amenityFallbackName(catId) : 'Other'
	};
	const names = opts.amenityNames ?? {};
	const rawAmenities = raw['amenities'];
	const amenities = Array.isArray(rawAmenities)
		? rawAmenities
				.map(String)
				.map((a) => (a.startsWith('no-') ? amenity(a.slice(3), false, names) : amenity(a, true, names)))
		: Object.entries((rawAmenities as Record<string, unknown>) ?? {}).map(([id, v]) =>
				amenity(id, v !== false, names)
			);
	const geo = (raw['geo'] ?? raw['location']) as Record<string, unknown> | undefined;
	return {
		name: edited.name.trim() || s(raw['name']) || '',
		nameTh: s(raw['name_th']),
		description: s(edited.description),
		descriptionTh: s(raw['description_th']),
		category,
		areaName: opts.areaName ?? (s(raw['area']) ? amenityFallbackName(String(raw['area'])) : undefined),
		address: s(edited.address) ?? s(raw['address']),
		phone: s(raw['phone']),
		lineId: s(raw['line_id']),
		whatsapp: s(raw['whatsapp']),
		hasGeo:
			!!geo &&
			(n(geo['lat'] ?? geo['latitude']) !== undefined || n(geo['lng'] ?? geo['longitude']) !== undefined),
		bookingNote: s(raw['booking_note']),
		hours: parseWeeklyHours(raw['hours']),
		hoursNote: s(raw['hours_note']),
		amenities,
		menu: parseMenu(raw['menu']),
		menuNote: s(raw['menu_note']),
		menuNoteTh: s(raw['menu_note_th']),
		images: (Array.isArray(raw['images']) ? raw['images'] : []).map(String).filter((u) => /^https?:\/\//.test(u)),
		claimed: raw['claimed'] === true,
		rating: n(raw['rating']),
		ratingCount: n(raw['rating_count']),
		priceBand: n(raw['price_band'])
	};
}
