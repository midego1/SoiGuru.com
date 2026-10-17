import type { GeoPoint } from './types';

/** Great-circle distance in metres. */
export function distanceMetres(a: GeoPoint, b: GeoPoint): number {
	const R = 6371000;
	const rad = (x: number) => (x * Math.PI) / 180;
	const dLat = rad(b.lat - a.lat);
	const dLng = rad(b.lng - a.lng);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/** "450 m" under 1 km, "2.3 km" above (README: Content). */
export function formatDistance(metres: number): string {
	if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
	return `${(metres / 1000).toFixed(1)} km`;
}

/** Walking minutes at ~4.8 km/h. */
export function walkingMinutes(metres: number): number {
	return Math.max(1, Math.round(metres / 80));
}

export function formatPriceBand(band?: number): string | undefined {
	if (!band || band < 1) return undefined;
	return '฿'.repeat(Math.min(3, Math.round(band)));
}

/** E.164 Thai number (+66812345678) to the local display form (081-234-5678). */
export function formatThaiPhone(e164?: string): string | undefined {
	if (!e164) return undefined;
	const digits = e164.replace(/[^\d+]/g, '');
	if (!digits.startsWith('+66')) return e164;
	const local = '0' + digits.slice(3);
	if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
	if (local.length === 9) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
	return local;
}

export function telHref(e164: string): string {
	return `tel:${e164.replace(/[^\d+]/g, '')}`;
}

export function whatsappHref(e164: string): string {
	return `https://wa.me/${e164.replace(/\D/g, '')}`;
}

export function lineHref(lineId: string): string {
	const id = lineId.trim();
	return id.startsWith('@')
		? `https://line.me/R/ti/p/@${encodeURIComponent(id.slice(1))}`
		: `https://line.me/R/ti/p/~${encodeURIComponent(id)}`;
}

export function directionsHref(geo: GeoPoint): string {
	return `https://www.google.com/maps/dir/?api=1&destination=${geo.lat},${geo.lng}`;
}
