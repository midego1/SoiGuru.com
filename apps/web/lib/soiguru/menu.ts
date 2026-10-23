/**
* Menu & prices (spec 069): a listing's `menu` is a list of sections, each with items that
* carry a name (English, optional Thai), a price in baht and an optional note. It works for
* any trade: dishes for a restaurant, treatments for a nail studio, day trips for a tour desk.
*
* ```yaml
* menu:
*   - title: Haircuts
*     title_th: ตัดผม
*     items:
*       - { name: Men's haircut, name_th: ตัดผมชาย, price: 350, note: 30 min }
*       - { name: Hair colour, price: 1200, price_max: 2500 }
*       - { name: Island day trip, price: 1500, from: true, note: per person }
* menu_note: Prices include VAT
* ```
*
* A flat list of items (no sections) is accepted as one untitled section. The same parser
* lives in the owner app (`lib/soiguru/menu.ts`), which writes the field.
*/

export interface MenuItem {
	name: string;
	name_th?: string;
	/** Price in baht; with `price_max` a range, with `from` a starting price. */
	price?: number;
	price_max?: number;
	from?: boolean;
	note?: string;
	note_th?: string;
}

export interface MenuSection {
	title?: string;
	title_th?: string;
	items: MenuItem[];
}

export const MENU_MAX_SECTIONS = 12;
export const MENU_MAX_ITEMS = 40;
export const MENU_MAX_PRICE = 999999;

const str = (v: unknown, max = 120): string | undefined =>
	typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : undefined;

const price = (v: unknown): number | undefined => {
	const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
	return Number.isFinite(n) && n >= 0 && n <= MENU_MAX_PRICE ? Math.round(n * 100) / 100 : undefined;
};

function toItem(raw: unknown): MenuItem | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const name = str(r['name'], 80);
	if (!name) return null;
	const p = price(r['price']);
	const max = price(r['price_max']);
	return {
		name,
		name_th: str(r['name_th'], 80),
		price: p,
		price_max: p !== undefined && max !== undefined && max > p ? max : undefined,
		from: r['from'] === true && p !== undefined ? true : undefined,
		note: str(r['note'], 80),
		note_th: str(r['note_th'], 80)
	};
}

/** Parses the raw `menu` value; unknown shapes give an empty list. */
export function parseMenu(raw: unknown): MenuSection[] {
	if (!Array.isArray(raw)) return [];
	const flat = raw.map(toItem).filter((i): i is MenuItem => i !== null);
	// A plain list of items: one section without a title.
	if (flat.length > 0 && raw.every((r) => r && typeof r === 'object' && !('items' in (r as object)))) {
		return [{ items: flat.slice(0, MENU_MAX_ITEMS) }];
	}
	const sections: MenuSection[] = [];
	for (const r of raw) {
		if (!r || typeof r !== 'object') continue;
		const s = r as Record<string, unknown>;
		const items = (Array.isArray(s['items']) ? s['items'] : [])
			.map(toItem)
			.filter((i): i is MenuItem => i !== null)
			.slice(0, MENU_MAX_ITEMS);
		if (items.length === 0) continue;
		sections.push({ title: str(s['title'], 60), title_th: str(s['title_th'], 60), items });
		if (sections.length >= MENU_MAX_SECTIONS) break;
	}
	return sections;
}

const baht = (n: number): string => `฿${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** `฿350`, `฿350–500`, `from ฿350` (Thai: `เริ่ม ฿350`); empty when the item has no price. */
export function formatPrice(item: MenuItem, lang: 'en' | 'th' = 'en'): string {
	if (item.price === undefined) return '';
	if (item.price_max !== undefined) return `${baht(item.price)}–${item.price_max.toLocaleString('en-US')}`;
	if (item.from) return lang === 'th' ? `เริ่ม ${baht(item.price)}` : `from ${baht(item.price)}`;
	return baht(item.price);
}

/** Words the search box should match: every item and section name in both scripts. */
export function menuSearchText(menu: MenuSection[]): string[] {
	return menu.flatMap((s) => [s.title, s.title_th, ...s.items.flatMap((i) => [i.name, i.name_th])]).filter((t): t is string => Boolean(t));
}

/** Number of items across all sections. */
export function menuItemCount(menu: MenuSection[]): number {
	return menu.reduce((n, s) => n + s.items.length, 0);
}

/**
 * Builds the sections from the owner form (spec 069): fields `s<i>_title`, `s<i>_title_th` and
 * per row `s<i>_i<j>_name`, `_name_th`, `_price`, `_price_max`, `_from`, `_note`, `_note_th`.
 * Rows without a name and sections without rows are dropped, so clearing a name removes it.
 */
export function menuFromForm(get: (key: string) => string | undefined, on: (key: string) => boolean): MenuSection[] {
	const sections: MenuSection[] = [];
	for (let i = 0; i < MENU_MAX_SECTIONS + 1; i++) {
		if (get(`s${i}_title`) === undefined && get(`s${i}_i0_name`) === undefined) break;
		const items: Record<string, unknown>[] = [];
		for (let j = 0; j < MENU_MAX_ITEMS + 3; j++) {
			const name = get(`s${i}_i${j}_name`);
			if (name === undefined) break;
			items.push({
				name,
				name_th: get(`s${i}_i${j}_name_th`),
				price: get(`s${i}_i${j}_price`),
				price_max: get(`s${i}_i${j}_price_max`),
				from: on(`s${i}_i${j}_from`),
				note: get(`s${i}_i${j}_note`),
				note_th: get(`s${i}_i${j}_note_th`)
			});
		}
		sections.push({ title: get(`s${i}_title`), title_th: get(`s${i}_title_th`), items: items as unknown as MenuItem[] });
	}
	// Re-parse through the same rules as content from the repo (limits, empty rows).
	return parseMenu(sections);
}
