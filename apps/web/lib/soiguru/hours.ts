import { WEEKDAYS, type TimeRange, type Weekday, type WeeklyHours } from './types';

/** Every city SoiGuru serves is in Thailand: opening hours are Bangkok time. */
export const CITY_TIME_ZONE = 'Asia/Bangkok';

function toMinutes(hhmm: string): number | null {
	const m = /^(\d{1,2})[:.](\d{2})$/.exec(hhmm.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
	return h * 60 + min;
}

/** Parses `"10:00-21:00"`, `"10:00-14:00,17:00-22:00"`, `"closed"` or a list of ranges. */
export function parseDayHours(raw: unknown): TimeRange[] | null {
	if (raw === undefined || raw === null || raw === '') return null;
	if (raw === false || (Array.isArray(raw) && raw.length === 0)) return [];
	const parts = Array.isArray(raw) ? raw.map(String) : String(raw).split(',');
	if (parts.length === 1 && /^closed$/i.test(parts[0].trim())) return [];
	const ranges: TimeRange[] = [];
	for (const part of parts) {
		const [a, b] = part.split(/[-–]/);
		if (!a || !b) continue;
		const start = toMinutes(a);
		const end = toMinutes(b);
		if (start === null || end === null) continue;
		// Past-midnight ranges ("18:00-02:00") are clipped to the day for now.
		ranges.push({ start, end: end <= start ? 1440 : end });
	}
	return ranges.length ? ranges : null;
}

export function parseWeeklyHours(raw: unknown): WeeklyHours {
	const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const out = {} as WeeklyHours;
	for (const d of WEEKDAYS) out[d] = parseDayHours(src[d]);
	return out;
}

export function formatMinutes(min: number): string {
	const h = Math.floor(min / 60);
	const m = min % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatRanges(ranges: TimeRange[]): string[] {
	return ranges.map((r) =>
		r.start === 0 && r.end === 1440 ? '24h' : `${formatMinutes(r.start)}–${formatMinutes(r.end)}`
	);
}

/** Weekday and minutes-since-midnight in the city's time zone. */
export function cityNow(now: Date = new Date()): { day: Weekday; minutes: number } {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: CITY_TIME_ZONE,
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(now);
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
	const day = get('weekday').slice(0, 3).toLowerCase() as Weekday;
	return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export type OpenState = 'open' | 'soon' | 'opens' | 'closed' | 'unknown';

export interface OpenStatus {
	state: OpenState;
	/** The time the sentence names ("closes 21:00", "opens at 10:00"). */
	time?: string;
	/** Set when the next opening is on another day. */
	nextDay?: Weekday;
}

const SOON_MINUTES = 60;
const OPENS_WITHIN_MINUTES = 12 * 60;

/**
 * Open status per the OpenStatus component spec: open (> 60 min left),
 * soon (< 60 min left, or opening within 12 h), closed, unknown (no hours).
 * Computed at render time from Bangkok local time, never stored.
 */
export function getOpenStatus(hours: WeeklyHours, now: Date = new Date()): OpenStatus {
	if (WEEKDAYS.every((d) => hours[d] === null)) return { state: 'unknown' };
	const { day, minutes } = cityNow(now);
	const today = hours[day] ?? [];
	const current = today.find((r) => minutes >= r.start && minutes < r.end);
	if (current) {
		const end = current.end;
		const closesAt = end === 1440 ? '24:00' : formatMinutes(end);
		if (current.start === 0 && end === 1440) return { state: 'open', time: '24h' };
		return { state: end - minutes <= SOON_MINUTES ? 'soon' : 'open', time: closesAt };
	}
	// Next opening: later today, then the following days.
	const idx = WEEKDAYS.indexOf(day);
	for (let offset = 0; offset < 7; offset++) {
		const d = WEEKDAYS[(idx + offset) % 7];
		const ranges = (hours[d] ?? []).filter((r) => offset > 0 || r.start > minutes);
		if (!ranges.length) continue;
		const start = ranges[0].start;
		const until = offset * 1440 + start - minutes;
		if (offset === 0 || until <= OPENS_WITHIN_MINUTES) {
			return { state: 'opens', time: formatMinutes(start), nextDay: offset === 0 ? undefined : d };
		}
		return { state: 'closed', time: formatMinutes(start), nextDay: d };
	}
	return { state: 'closed' };
}

export function isOpenNow(status: OpenStatus): boolean {
	return status.state === 'open' || status.state === 'soon';
}

export interface HoursRow {
	days: Weekday[];
	ranges: TimeRange[] | null;
	today: boolean;
}

/**
 * HoursTable rows: today first, then the rest of the week in order, with
 * consecutive identical days merged ("Mon–Wed").
 */
export function hoursTableRows(hours: WeeklyHours, now: Date = new Date()): HoursRow[] {
	const { day } = cityNow(now);
	const idx = WEEKDAYS.indexOf(day);
	const order = WEEKDAYS.map((_, i) => WEEKDAYS[(idx + i) % 7]);
	const key = (r: TimeRange[] | null) => JSON.stringify(r);
	const rows: HoursRow[] = [{ days: [day], ranges: hours[day], today: true }];
	for (const d of order.slice(1)) {
		const last = rows[rows.length - 1];
		if (!last.today && key(last.ranges) === key(hours[d])) last.days.push(d);
		else rows.push({ days: [d], ranges: hours[d], today: false });
	}
	return rows;
}
