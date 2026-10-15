import 'server-only';
import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE } from '@/lib/constants';
import type { Area, City, Listing, ListingCategory } from './types';
import type { OpenStatus } from './hours';

/**
 * Per-request rendering context for the SoiGuru screens: the locale, its URL
 * prefix (none for the default locale), whether Thai is the UI language, and
 * the `soiguru` message namespace.
 */
export async function getSgContext(locale: string) {
	const t = await getTranslations({ locale, namespace: 'soiguru' });
	const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
	const thai = locale === 'th';
	return {
		locale,
		prefix,
		thai,
		t,
		/** Prefixes an app path with the locale ("/krabi" → "/th/krabi"). */
		href: (path: string) => `${prefix}${path === '/' && prefix ? '' : path}`
	};
}

export type SgContext = Awaited<ReturnType<typeof getSgContext>>;

type Named = { name: string; name_th?: string };

/** The name in the UI language; Thai falls back to English. */
export function localName(ctx: SgContext, x: Named): string {
	return (ctx.thai && x.name_th) || x.name;
}

/** The name in the other script, if the content has one ("Ao Nang" ↔ "อ่าวนาง"). */
export function otherName(ctx: SgContext, x: Named): string | undefined {
	return ctx.thai ? (x.name_th ? x.name : undefined) : x.name_th;
}

export function listingTitle(ctx: SgContext, l: Listing): string {
	return (ctx.thai && l.nameTh) || l.name;
}

export function listingOtherName(ctx: SgContext, l: Listing): string | undefined {
	return ctx.thai ? (l.nameTh ? l.name : undefined) : l.nameTh;
}

export function categoryName(ctx: SgContext, c: ListingCategory): string {
	return localName(ctx, c);
}

export function areaName(ctx: SgContext, city: City, areaId: string): string {
	const a: Area | undefined = city.areas.find((x) => x.id === areaId);
	return a ? localName(ctx, a) : areaId;
}

export function listingPath(l: Listing): string {
	return `/${l.city}/${l.area}/${l.slug}`;
}

/** OpenStatus sentence: always the word plus the time (README: Content). */
export function statusText(ctx: SgContext, s: OpenStatus): string {
	const { t } = ctx;
	switch (s.state) {
		case 'open':
			return s.time === '24h' ? t('status.open24') : t('status.open', { time: s.time ?? '' });
		case 'soon':
			return t('status.soon', { time: s.time ?? '' });
		case 'opens':
			return s.nextDay
				? t('status.opensDay', { day: t(`days.${s.nextDay}`), time: s.time ?? '' })
				: t('status.opensAt', { time: s.time ?? '' });
		case 'closed':
			return s.nextDay
				? t('status.closedOpens', { day: t(`days.${s.nextDay}`), time: s.time ?? '' })
				: t('status.closedToday');
		default:
			return t('status.unknown');
	}
}

export function statusClass(s: OpenStatus): string {
	switch (s.state) {
		case 'open':
			return 'tkg-status tkg-status-open';
		case 'soon':
		case 'opens':
			return 'tkg-status tkg-status-soon';
		case 'closed':
			return 'tkg-status tkg-status-closed';
		default:
			return 'tkg-status tkg-status-unknown';
	}
}

/** "3 days ago" in the UI language. */
export function relativeTime(ctx: SgContext, date: Date, now: Date = new Date()): string {
	const rtf = new Intl.RelativeTimeFormat(ctx.locale, { numeric: 'auto' });
	const diffDays = Math.round((date.getTime() - now.getTime()) / 86_400_000);
	if (Math.abs(diffDays) < 1) return rtf.format(0, 'day');
	if (Math.abs(diffDays) < 31) return rtf.format(diffDays, 'day');
	const diffMonths = Math.round(diffDays / 30);
	if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month');
	return rtf.format(Math.round(diffDays / 365), 'year');
}

/** A calendar date in the UI language, in Bangkok time ("12 Mar 2027"). */
export function formatDay(ctx: SgContext, d: Date | null | undefined): string {
	if (!d) return '';
	return d.toLocaleDateString(ctx.thai ? 'th-TH' : 'en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Bangkok'
	});
}
