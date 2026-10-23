/**
 * SoiGuru domain types: cities, areas, categories and local-business listings.
 *
 * Listings are ordinary content items (`data/<slug>/<slug>.yml`) carrying the
 * extra local-business keys of the soiguru-data repo. `toListing()` in
 * `listings.ts` maps the raw item onto this shape.
 */

import type { MenuSection } from './menu';

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export interface GeoPoint {
	lat: number;
	lng: number;
}

/** One open interval in minutes since midnight; `end` may be 1440 (24:00). */
export interface TimeRange {
	start: number;
	end: number;
}

/** Per weekday: `null` = unknown, `[]` = closed, otherwise the open ranges. */
export type WeeklyHours = Record<Weekday, TimeRange[] | null>;

export interface Area {
	id: string;
	name: string;
	name_th?: string;
	geo?: GeoPoint;
	/** Reached by boat only (Railay): distances get "· boat". */
	boat?: boolean;
}

export interface City {
	id: string;
	name: string;
	name_th?: string;
	geo?: GeoPoint;
	/** Area used when the visitor has not picked one ("Open now in Ao Nang"). */
	defaultArea?: string;
	areas: Area[];
}

export interface Amenity {
	id: string;
	name: string;
	name_th?: string;
}

export interface ListingCategory {
	id: string;
	name: string;
	name_th?: string;
	/** Icon name from the SoiGuru icon set (`components/soiguru/icon.tsx`). */
	icon: string;
	/** schema.org type for the listing page's JSON-LD (default `LocalBusiness`). */
	schemaType: string;
}

export interface Listing {
	slug: string;
	name: string;
	nameTh?: string;
	description?: string;
	descriptionTh?: string;
	category: ListingCategory;
	city: string;
	area: string;
	address?: string;
	geo?: GeoPoint;
	phone?: string;
	lineId?: string;
	whatsapp?: string;
	hours: WeeklyHours;
	hasHours: boolean;
	priceBand?: number;
	/** Menu & prices (spec 069): sections of priced items; empty when none. */
	menu: MenuSection[];
	menuNote?: string;
	menuNoteTh?: string;
	rating?: number;
	ratingCount?: number;
	claimed: boolean;
	/** `available: false` marks a notable missing amenity ("No parking"). */
	amenities: { id: string; available: boolean }[];
	bookingNote?: string;
	hoursNote?: string;
	updatedBy?: 'owner' | 'import' | string;
	updatedAt?: Date;
	images: string[];
	sample: boolean;
}
