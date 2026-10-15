import 'server-only';
import { cache } from 'react';
import fsp from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { fetchItems, type ItemData } from '@/lib/content';
import { getContentPath } from '@/lib/lib';
import { parseWeeklyHours } from './hours';
import { WEEKDAYS, type Amenity, type Area, type City, type GeoPoint, type Listing, type ListingCategory } from './types';

/**
 * The three launch cities. Used when the content repository has no
 * `cities.yml` yet, so the routes and the landing page always resolve.
 */
const DEFAULT_CITIES: City[] = [
	{
		id: 'krabi',
		name: 'Krabi',
		name_th: 'กระบี่',
		geo: { lat: 8.0863, lng: 98.9063 },
		areas: [
			{ id: 'ao-nang', name: 'Ao Nang', name_th: 'อ่าวนาง' },
			{ id: 'railay', name: 'Railay', name_th: 'ไร่เลย์', boat: true },
			{ id: 'krabi-town', name: 'Krabi Town', name_th: 'เมืองกระบี่' },
			{ id: 'klong-muang', name: 'Klong Muang', name_th: 'คลองม่วง' }
		]
	},
	{ id: 'chiang-mai', name: 'Chiang Mai', name_th: 'เชียงใหม่', geo: { lat: 18.7883, lng: 98.9853 }, areas: [] },
	{ id: 'lam-plai-mat', name: 'Lam Plai Mat', name_th: 'ลำปลายมาศ', geo: { lat: 15.0097, lng: 102.8451 }, areas: [] }
];

/** The eight shared categories, in the CityHome tile order. */
const DEFAULT_CATEGORIES: ListingCategory[] = [
	{ id: 'restaurants', name: 'Restaurants', name_th: 'ร้านอาหาร', icon: 'home', schemaType: 'Restaurant' },
	{ id: 'cafes', name: 'Cafés', name_th: 'คาเฟ่', icon: 'cash', schemaType: 'CafeOrCoffeeShop' },
	{ id: 'massage', name: 'Massage', name_th: 'นวด', icon: 'heart', schemaType: 'DaySpa' },
	{ id: 'tours', name: 'Tours', name_th: 'ทัวร์', icon: 'map', schemaType: 'TravelAgency' },
	{ id: 'scooter-rental', name: 'Scooter rental', name_th: 'เช่ามอเตอร์ไซค์', icon: 'bolt', schemaType: 'AutoRental' },
	{ id: 'nail-salons', name: 'Nail salons', name_th: 'ร้านทำเล็บ', icon: 'star', schemaType: 'NailSalon' },
	{ id: 'dive-shops', name: 'Dive shops', name_th: 'ร้านดำน้ำ', icon: 'globe', schemaType: 'SportsActivityLocation' },
	{ id: 'hotels', name: 'Hotels', name_th: 'โรงแรม', icon: 'calendar', schemaType: 'Hotel' }
];

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
	const n = typeof v === 'string' ? Number(v) : v;
	return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

function toGeo(v: unknown): GeoPoint | undefined {
	if (!v || typeof v !== 'object') return undefined;
	const o = v as Record<string, unknown>;
	const lat = num(o.lat ?? o.latitude);
	const lng = num(o.lng ?? o.lon ?? o.longitude);
	return lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
}

async function readYamlList(file: string): Promise<Record<string, unknown>[] | null> {
	try {
		const raw = await fsp.readFile(path.join(getContentPath(), file), 'utf-8');
		const parsed = yaml.parse(raw);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** Cities from the content repo's `cities.yml`, else the launch defaults. */
export const getCities = cache(async (): Promise<City[]> => {
	const list = await readYamlList('cities.yml');
	if (!list?.length) return DEFAULT_CITIES;
	return list
		.filter((c) => str(c.id) && str(c.name))
		.map((c) => ({
			id: String(c.id),
			name: String(c.name),
			name_th: str(c.name_th),
			geo: toGeo(c.geo),
			defaultArea: str(c.default_area),
			areas: (Array.isArray(c.areas) ? c.areas : [])
				.filter((a: Record<string, unknown>) => str(a?.id) && str(a?.name))
				.map((a: Record<string, unknown>) => ({
					id: String(a.id),
					name: String(a.name),
					name_th: str(a.name_th),
					geo: toGeo(a.geo),
					boat: a.boat_only === true || a.boat === true
				}))
		}));
});

export async function getCity(id: string): Promise<City | undefined> {
	return (await getCities()).find((c) => c.id === id);
}

export function findArea(city: City, id: string): Area | undefined {
	return city.areas.find((a) => a.id === id);
}

/** Categories from the content repo, falling back to the shared eight. */
export const getCategories = cache(async (): Promise<ListingCategory[]> => {
	const list = await readYamlList('categories.yml');
	if (!list?.length) return DEFAULT_CATEGORIES;
	return [...list]
		.filter((c) => str(c.id) && str(c.name))
		.sort((a, b) => (num(b.priority) ?? 0) - (num(a.priority) ?? 0))
		.map((c) => {
			const fallback = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
			return {
				id: String(c.id),
				name: String(c.name),
				name_th: str(c.name_th) ?? fallback?.name_th,
				icon: str(c.icon) ?? fallback?.icon ?? 'pin',
				schemaType: str(c.schema_type) ?? fallback?.schemaType ?? 'LocalBusiness'
			};
		});
});

/** Amenity labels (EN/TH) from `amenities.yml`; unknown ids get a readable fallback. */
export const getAmenities = cache(async (): Promise<Map<string, Amenity>> => {
	const list = (await readYamlList('amenities.yml')) ?? [];
	return new Map(
		list
			.filter((a) => str(a.id) && str(a.name))
			.map((a) => [String(a.id), { id: String(a.id), name: String(a.name), name_th: str(a.name_th) }])
	);
});

export function amenityLabel(amenities: Map<string, Amenity>, id: string, thai: boolean): string {
	const a = amenities.get(id);
	if (a) return (thai && a.name_th) || a.name;
	const text = id.replace(/-/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function categoryId(raw: ItemData['category']): string | undefined {
	const first = Array.isArray(raw) ? raw[0] : raw;
	if (!first) return undefined;
	return typeof first === 'string' ? first : first.id;
}

function toListing(item: ItemData, categories: ListingCategory[]): Listing | null {
	const raw = item as unknown as Record<string, unknown>;
	const city = str(raw.city);
	const area = str(raw.area);
	if (!city || !area) return null;
	const catId = categoryId(item.category);
	const category = categories.find((c) => c.id === catId) ?? {
		id: catId ?? 'other',
		name: catId ?? 'Other',
		icon: 'pin',
		schemaType: 'LocalBusiness'
	};
	const hours = parseWeeklyHours(raw.hours);
	// `amenities` is a map of id -> boolean (false = notably missing); a plain
	// list of ids (with a `no-` prefix for missing ones) is accepted too.
	const amenities = Array.isArray(raw.amenities)
		? raw.amenities
				.map(String)
				.map((a) => (a.startsWith('no-') ? { id: a.slice(3), available: false } : { id: a, available: true }))
		: Object.entries((raw.amenities as Record<string, unknown>) ?? {}).map(([id, v]) => ({ id, available: v !== false }));
	const images = (Array.isArray(raw.images) ? raw.images : []).map(String).filter((u) => /^https?:\/\//.test(u));
	const updatedAt = item.updatedAt instanceof Date && !Number.isNaN(item.updatedAt.getTime()) ? item.updatedAt : undefined;
	return {
		slug: item.slug,
		name: item.name,
		nameTh: str(raw.name_th),
		description: str(item.description),
		descriptionTh: str(raw.description_th),
		category,
		city,
		area,
		address: str(raw.address),
		geo: toGeo(raw.geo) ?? toGeo(raw.location),
		phone: str(raw.phone),
		lineId: str(raw.line_id),
		whatsapp: str(raw.whatsapp),
		hours,
		hasHours: WEEKDAYS.some((d) => hours[d] !== null),
		priceBand: num(raw.price_band),
		rating: num(raw.rating),
		ratingCount: num(raw.rating_count),
		claimed: raw.claimed === true,
		amenities,
		bookingNote: str(raw.booking_note),
		hoursNote: str(raw.hours_note),
		updatedBy: str(raw.updated_by),
		updatedAt,
		images,
		sample: raw.sample === true
	};
}

/** All listings (items that carry a `city` and an `area`). */
export const getListings = cache(async (): Promise<Listing[]> => {
	const [{ items }, categories] = await Promise.all([fetchItems(), getCategories()]);
	return items.map((i) => toListing(i, categories)).filter((l): l is Listing => l !== null);
});

export async function getCityListings(cityId: string): Promise<Listing[]> {
	return (await getListings()).filter((l) => l.city === cityId);
}

export async function getListing(cityId: string, areaId: string, slug: string): Promise<Listing | undefined> {
	return (await getCityListings(cityId)).find((l) => l.slug === slug && l.area === areaId);
}
