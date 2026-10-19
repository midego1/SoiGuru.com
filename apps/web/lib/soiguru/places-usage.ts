import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

/**
 * Keeps Google Places inside Google's free monthly usage, so it never costs money (spec 060).
 *
 * Billable SKUs and their free calls per month (Google Maps Platform, March 2025 pricing):
 * - `photo`: Place Details Photos (each photo image), 1,000 free.
 * - `search`: Text Search Pro (finding a listing's place), 5,000 free.
 * The photo list itself (Place Details with only `photos`, "Essentials IDs Only") is free.
 *
 * Caps default below the free amounts (900 and 4,000) and can be lowered, never raised past
 * them, with `PLACES_PHOTO_MONTHLY_LIMIT` / `PLACES_SEARCH_MONTHLY_LIMIT`. The count is stored per
 * Google billing month (Pacific time) in `soiguru_places_usage`, so restarts and deploys keep it.
 * Use is paced over the month: by day d of an n-day month at most cap × d / n calls, so a busy
 * day cannot spend the whole month. When the database cannot be reached the call is refused:
 * no photo is better than a bill.
 */

export type BillableSku = 'photo' | 'search';

const FREE: Record<BillableSku, number> = { photo: 1000, search: 5000 };
const DEFAULT_CAP: Record<BillableSku, number> = { photo: 900, search: 4000 };
const ENV: Record<BillableSku, string | undefined> = {
	photo: process.env.PLACES_PHOTO_MONTHLY_LIMIT,
	search: process.env.PLACES_SEARCH_MONTHLY_LIMIT
};

/** The monthly cap for a SKU: the env value or the default, never above the free amount minus 5%. */
export function monthlyCap(sku: BillableSku): number {
	const ceiling = Math.floor(FREE[sku] * 0.95);
	const fromEnv = Number(ENV[sku]);
	const cap = Number.isFinite(fromEnv) && ENV[sku] !== undefined && ENV[sku] !== '' ? fromEnv : DEFAULT_CAP[sku];
	return Math.max(0, Math.min(Math.floor(cap), ceiling));
}

/** Google's billing month in Pacific time: `YYYY-MM`, today's day and the month's length. */
export function billingMonth(now = new Date()): { month: string; day: number; days: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
	const year = get('year');
	const month = get('month');
	const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return { month: `${year}-${String(month).padStart(2, '0')}`, day: get('day'), days };
}

/** How many calls of a SKU may have been made by today (the paced allowance). */
export function allowanceToday(sku: BillableSku, now = new Date()): number {
	const { day, days } = billingMonth(now);
	return Math.ceil((monthlyCap(sku) * day) / days);
}

/**
 * Count one billable call. Returns true when it fits this month's paced allowance (and is now
 * counted), false when the call must be skipped. Atomic in the database.
 */
export async function takeMonthly(sku: BillableSku, now = new Date()): Promise<boolean> {
	const allowance = allowanceToday(sku, now);
	if (allowance < 1) return false;
	const { month } = billingMonth(now);
	try {
		const result = await db.execute(sql`
			INSERT INTO soiguru_places_usage (month, sku, count, updated_at)
			VALUES (${month}, ${sku}, 1, now())
			ON CONFLICT (month, sku) DO UPDATE
				SET count = soiguru_places_usage.count + 1, updated_at = now()
				WHERE soiguru_places_usage.count < ${allowance}
			RETURNING count
		`);
		const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) ?? [];
		return rows.length > 0;
	} catch (error) {
		console.error(
			'[places-usage] refused, usage could not be counted:',
			error instanceof Error ? error.message : error
		);
		return false;
	}
}

/** This month's counts, for an admin view or logs. */
export async function monthlyUsage(now = new Date()): Promise<Record<BillableSku, { used: number; cap: number }>> {
	const { month } = billingMonth(now);
	const out: Record<BillableSku, { used: number; cap: number }> = {
		photo: { used: 0, cap: monthlyCap('photo') },
		search: { used: 0, cap: monthlyCap('search') }
	};
	try {
		const result = await db.execute(sql`SELECT sku, count FROM soiguru_places_usage WHERE month = ${month}`);
		const rows = ((Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) ?? []) as {
			sku: string;
			count: number;
		}[];
		for (const r of rows) if (r.sku === 'photo' || r.sku === 'search') out[r.sku].used = Number(r.count);
	} catch {
		// leave zeros
	}
	return out;
}
