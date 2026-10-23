'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icon';
import { formatPrice, MENU_MAX_ITEMS, MENU_MAX_SECTIONS, type MenuSection } from '@/lib/soiguru/menu';
import { menuTemplate, parsePastedMenu } from '@/lib/soiguru/menu-templates';

/**
 * Menu & prices editor (spec 069, interactive version 2026-10-23). Sections of rows that the
 * owner adds, removes and reorders; "Enter" in a row moves to the next one (and makes it when
 * needed); starter sections per trade; "paste a list" turns "Gel manicure 500" lines into
 * rows; a preview shows the list as visitors see it. Every field is a named input inside the
 * page's form, so the server action (`saveMenu`) reads it like the scripted-free version:
 * `s<i>_title`, `s<i>_title_th`, `s<i>_i<j>_name`, `_name_th`, `_price`, `_price_max`,
 * `_from`, `_note`, `_note_th`. Without script the saved rows are still editable.
 */

interface Row {
	key: number;
	name: string;
	name_th: string;
	price: string;
	price_max: string;
	range: boolean;
	from: boolean;
	note: string;
	note_th: string;
}
interface Section {
	key: number;
	title: string;
	title_th: string;
	items: Row[];
}

let seq = 1;
const nextKey = () => seq++;
const blankRow = (): Row => ({ key: nextKey(), name: '', name_th: '', price: '', price_max: '', range: false, from: false, note: '', note_th: '' });
const blankSection = (title = '', title_th = ''): Section => ({ key: nextKey(), title, title_th, items: [blankRow()] });

function fromSaved(menu: MenuSection[]): Section[] {
	return menu.map((s) => ({
		key: nextKey(),
		title: s.title ?? '',
		title_th: s.title_th ?? '',
		items: s.items.map((i) => ({
			key: nextKey(),
			name: i.name,
			name_th: i.name_th ?? '',
			price: i.price === undefined ? '' : String(i.price),
			price_max: i.price_max === undefined ? '' : String(i.price_max),
			range: i.price_max !== undefined,
			from: i.from === true,
			note: i.note ?? '',
			note_th: i.note_th ?? ''
		}))
	}));
}

export function MenuEditor({
	initial,
	categoryId,
	categoryName,
	thai
}: {
	initial: MenuSection[];
	categoryId?: string;
	categoryName: string;
	/** The owner reads the app in Thai: the preview shows Thai names first. */
	thai: boolean;
}) {
	const t = useTranslations('soiguru.owner');
	const [sections, setSections] = useState<Section[]>(() => fromSaved(initial));
	const [pasteOpen, setPasteOpen] = useState(false);
	const [pasteText, setPasteText] = useState('');
	const rootRef = useRef<HTMLDivElement>(null);

	const update = (fn: (prev: Section[]) => Section[]) => setSections((prev) => fn(prev));
	const setSection = (si: number, patch: Partial<Section>) =>
		update((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));
	const setRow = (si: number, ri: number, patch: Partial<Row>) =>
		update((prev) => prev.map((s, i) => (i === si ? { ...s, items: s.items.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : s)));
	const addRow = (si: number, after?: number) =>
		update((prev) =>
			prev.map((s, i) => {
				if (i !== si || s.items.length >= MENU_MAX_ITEMS) return s;
				const items = [...s.items];
				items.splice(after === undefined ? items.length : after + 1, 0, blankRow());
				return { ...s, items };
			})
		);
	const removeRow = (si: number, ri: number) =>
		update((prev) => prev.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ri) } : s)));
	const moveRow = (si: number, ri: number, dir: -1 | 1) =>
		update((prev) =>
			prev.map((s, i) => {
				if (i !== si) return s;
				const to = ri + dir;
				if (to < 0 || to >= s.items.length) return s;
				const items = [...s.items];
				[items[ri], items[to]] = [items[to], items[ri]];
				return { ...s, items };
			})
		);
	const addSection = (title = '', title_th = '') =>
		update((prev) => (prev.length >= MENU_MAX_SECTIONS ? prev : [...prev, blankSection(title, title_th)]));
	const removeSection = (si: number) => update((prev) => prev.filter((_, i) => i !== si));
	const moveSection = (si: number, dir: -1 | 1) =>
		update((prev) => {
			const to = si + dir;
			if (to < 0 || to >= prev.length) return prev;
			const next = [...prev];
			[next[si], next[to]] = [next[to], next[si]];
			return next;
		});

	const useTemplate = () =>
		update((prev) => {
			const have = new Set(prev.map((s) => s.title.toLowerCase()));
			const add = menuTemplate(categoryId)
				.filter((s) => !have.has(s.title.toLowerCase()))
				.map((s) => blankSection(s.title, s.title_th));
			return [...prev, ...add].slice(0, MENU_MAX_SECTIONS);
		});

	const addPasted = () => {
		const rows = parsePastedMenu(pasteText);
		if (!rows.length) return;
		update((prev) => {
			const next = prev.length ? [...prev] : [blankSection()];
			const last = { ...next[next.length - 1] };
			const kept = last.items.filter((r) => r.name.trim() !== '');
			const added = rows.map((r) => ({
				...blankRow(),
				name: /[฀-๿]/.test(r.name) ? '' : r.name,
				name_th: /[฀-๿]/.test(r.name) ? r.name : '',
				price: r.price === undefined ? '' : String(r.price),
				price_max: r.price_max === undefined ? '' : String(r.price_max),
				range: r.price_max !== undefined,
				from: r.from === true
			}));
			// A Thai-only line still needs a name for the English list: use the Thai text.
			for (const a of added) if (!a.name) a.name = a.name_th;
			last.items = [...kept, ...added].slice(0, MENU_MAX_ITEMS);
			next[next.length - 1] = last;
			return next;
		});
		setPasteText('');
		setPasteOpen(false);
	};

	/** Enter in a row: go to the next row's name (make one at the end), never submit. */
	const onRowKey = (si: number, ri: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const s = sections[si];
		if (ri === s.items.length - 1) addRow(si);
		requestAnimationFrame(() => {
			const el = rootRef.current?.querySelector<HTMLInputElement>(`input[name="s${si}_i${ri + 1}_name"]`);
			el?.focus();
		});
	};

	const total = sections.reduce((n, s) => n + s.items.filter((r) => r.name.trim()).length, 0);
	const empty = sections.length === 0;

	return (
		<div className="sg-me" ref={rootRef}>
			{empty ? (
				<div className="sg-me-start">
					<p className="sg-me-start-title">{t('menuStartTitle')}</p>
					<p className="tkg-muted tkg-small">{t('menuStartBody')}</p>
					<div className="sg-me-start-actions">
						<button type="button" className="tkg-btn tkg-btn-primary" onClick={useTemplate}>
							{t('menuUseLayout', { category: categoryName })}
						</button>
						<button type="button" className="tkg-btn tkg-btn-ghost" onClick={() => setPasteOpen(true)}>
							{t('menuPaste')}
						</button>
						<button type="button" className="tkg-btn tkg-btn-ghost" onClick={() => addSection()}>
							{t('menuStartEmpty')}
						</button>
					</div>
				</div>
			) : null}

			{sections.map((s, si) => (
				<fieldset key={s.key} className="sg-menu-section sg-me-section">
					<legend className="sr-only">{s.title || t('menuNewSection')}</legend>
					<div className="sg-me-section-h">
						<input
							className="tkg-input sg-menu-f-title"
							name={`s${si}_title`}
							value={s.title}
							onChange={(e) => setSection(si, { title: e.target.value })}
							placeholder={t('menuSectionPlaceholder')}
							aria-label={t('menuSection')}
							maxLength={60}
						/>
						<input
							className="tkg-input sg-menu-f-title"
							name={`s${si}_title_th`}
							value={s.title_th}
							onChange={(e) => setSection(si, { title_th: e.target.value })}
							placeholder={t('menuSectionTh')}
							aria-label={t('menuSectionTh')}
							maxLength={60}
							lang="th"
						/>
						<span className="sg-me-tools">
							<button type="button" className="tkg-iconbtn sg-me-ib" onClick={() => moveSection(si, -1)} disabled={si === 0} aria-label={t('menuMoveUp')} title={t('menuMoveUp')}>
								<Icon name="chevron-down" className="sg-me-up" />
							</button>
							<button type="button" className="tkg-iconbtn sg-me-ib" onClick={() => moveSection(si, 1)} disabled={si === sections.length - 1} aria-label={t('menuMoveDown')} title={t('menuMoveDown')}>
								<Icon name="chevron-down" />
							</button>
							<button
								type="button"
								className="tkg-iconbtn sg-me-ib sg-me-del"
								onClick={() => {
									if (s.items.some((r) => r.name.trim()) && !window.confirm(t('menuRemoveSectionConfirm'))) return;
									removeSection(si);
								}}
								aria-label={t('menuRemoveSection')}
								title={t('menuRemoveSection')}
							>
								<Icon name="close" />
							</button>
						</span>
					</div>

					<div className="sg-me-rows">
						{s.items.map((r, ri) => {
							const id = `s${si}_i${ri}`;
							return (
								<div key={r.key} className="sg-me-row">
									<input
										className="tkg-input sg-me-f-name"
										name={`${id}_name`}
										value={r.name}
										onChange={(e) => setRow(si, ri, { name: e.target.value })}
										onKeyDown={onRowKey(si, ri)}
										placeholder={t('menuItem')}
										aria-label={t('menuItem')}
										maxLength={80}
										autoFocus={ri === s.items.length - 1 && r.name === '' && s.items.length > 1}
									/>
									<span className="sg-me-price">
										<span className="sg-me-baht" aria-hidden="true">฿</span>
										<input
											className="tkg-input sg-me-f-price"
											name={`${id}_price`}
											type="number"
											inputMode="decimal"
											min={0}
											max={999999}
											step="any"
											value={r.price}
											onChange={(e) => setRow(si, ri, { price: e.target.value })}
											onKeyDown={onRowKey(si, ri)}
											placeholder="0"
											aria-label={t('menuPrice')}
										/>
										{r.range ? (
											<>
												<span className="tkg-muted">–</span>
												<input
													className="tkg-input sg-me-f-price"
													name={`${id}_price_max`}
													type="number"
													inputMode="decimal"
													min={0}
													max={999999}
													step="any"
													value={r.price_max}
													onChange={(e) => setRow(si, ri, { price_max: e.target.value })}
													onKeyDown={onRowKey(si, ri)}
													placeholder={t('menuPriceTo')}
													aria-label={t('menuPriceTo')}
												/>
											</>
										) : null}
									</span>
									<span className="sg-me-flags">
										<label className={`sg-me-chip${r.from ? ' is-on' : ''}`}>
											<input type="checkbox" name={`${id}_from`} checked={r.from} onChange={(e) => setRow(si, ri, { from: e.target.checked })} />
											{t('menuFrom')}
										</label>
										<label className={`sg-me-chip${r.range ? ' is-on' : ''}`}>
											<input type="checkbox" checked={r.range} onChange={(e) => setRow(si, ri, { range: e.target.checked, price_max: e.target.checked ? r.price_max : '' })} />
											{t('menuRange')}
										</label>
									</span>
									<input
										className="tkg-input sg-me-f-th"
										name={`${id}_name_th`}
										value={r.name_th}
										onChange={(e) => setRow(si, ri, { name_th: e.target.value })}
										onKeyDown={onRowKey(si, ri)}
										placeholder={t('menuItemTh')}
										aria-label={t('menuItemTh')}
										maxLength={80}
										lang="th"
									/>
									<input
										className="tkg-input sg-me-f-note"
										name={`${id}_note`}
										value={r.note}
										onChange={(e) => setRow(si, ri, { note: e.target.value })}
										onKeyDown={onRowKey(si, ri)}
										placeholder={t('menuItemNotePlaceholder')}
										aria-label={t('menuItemNote')}
										maxLength={80}
									/>
									<input
										className="tkg-input sg-me-f-note"
										name={`${id}_note_th`}
										value={r.note_th}
										onChange={(e) => setRow(si, ri, { note_th: e.target.value })}
										onKeyDown={onRowKey(si, ri)}
										placeholder={t('menuItemNoteTh')}
										aria-label={t('menuItemNoteTh')}
										maxLength={80}
										lang="th"
									/>
									<span className="sg-me-tools sg-me-rowtools">
										<button type="button" className="tkg-iconbtn sg-me-ib" onClick={() => moveRow(si, ri, -1)} disabled={ri === 0} aria-label={t('menuMoveUp')} title={t('menuMoveUp')}>
											<Icon name="chevron-down" className="sg-me-up" />
										</button>
										<button type="button" className="tkg-iconbtn sg-me-ib" onClick={() => moveRow(si, ri, 1)} disabled={ri === s.items.length - 1} aria-label={t('menuMoveDown')} title={t('menuMoveDown')}>
											<Icon name="chevron-down" />
										</button>
										<button type="button" className="tkg-iconbtn sg-me-ib sg-me-del" onClick={() => removeRow(si, ri)} aria-label={t('menuRemoveItem')} title={t('menuRemoveItem')}>
											<Icon name="close" />
										</button>
									</span>
								</div>
							);
						})}
					</div>
					<div className="sg-me-section-f">
						<button type="button" className="tkg-btn tkg-btn-ghost tkg-btn-sm" onClick={() => addRow(si)} disabled={s.items.length >= MENU_MAX_ITEMS}>
							<Icon name="plus" /> {t('menuAddItem')}
						</button>
					</div>
				</fieldset>
			))}

			{!empty ? (
				<div className="sg-me-actions">
					<button type="button" className="tkg-btn tkg-btn-secondary" onClick={() => addSection()} disabled={sections.length >= MENU_MAX_SECTIONS}>
						<Icon name="plus" /> {t('menuAddSection')}
					</button>
					<button type="button" className="tkg-btn tkg-btn-ghost" onClick={() => setPasteOpen((o) => !o)}>
						{t('menuPaste')}
					</button>
					{sections.length < MENU_MAX_SECTIONS ? (
						<button type="button" className="tkg-btn tkg-btn-ghost" onClick={useTemplate}>
							{t('menuAddLayout', { category: categoryName })}
						</button>
					) : null}
				</div>
			) : null}

			{pasteOpen ? (
				<div className="sg-me-paste">
					<label htmlFor="sg-me-paste">{t('menuPaste')}</label>
					<p className="tkg-small tkg-muted">{t('menuPasteHelp')}</p>
					<textarea
						id="sg-me-paste"
						className="tkg-input"
						rows={6}
						value={pasteText}
						onChange={(e) => setPasteText(e.target.value)}
						placeholder={'Gel manicure 500\nNail art from 50\nHair colour 1200-2500'}
					/>
					<div className="sg-me-start-actions">
						<button type="button" className="tkg-btn tkg-btn-primary" onClick={addPasted} disabled={!pasteText.trim()}>
							{t('menuPasteAdd', { count: parsePastedMenu(pasteText).length })}
						</button>
						<button type="button" className="tkg-btn tkg-btn-ghost" onClick={() => setPasteOpen(false)}>
							{t('cancel')}
						</button>
					</div>
				</div>
			) : null}

			<section className="sg-me-preview" aria-label={t('menuPreview')}>
				<h3>
					{t('menuPreview')} <small className="tkg-muted">· {t('menuSub', { count: total })}</small>
				</h3>
				{total === 0 ? (
					<p className="tkg-muted tkg-small">{t('menuPreviewEmpty')}</p>
				) : (
					sections.map((s) => {
						const rows = s.items.filter((r) => r.name.trim());
						if (!rows.length) return null;
						return (
							<div key={s.key} className="sg-me-pv-group">
								{(s.title || s.title_th) && <h4>{(thai && s.title_th) || s.title || s.title_th}</h4>}
								<ul>
									{rows.map((r) => {
										const price = Number(r.price);
										const max = Number(r.price_max);
										const item = {
											name: r.name,
											price: r.price !== '' && Number.isFinite(price) ? price : undefined,
											price_max: r.range && r.price_max !== '' && Number.isFinite(max) && max > price ? max : undefined,
											from: r.from || undefined
										};
										return (
											<li key={r.key}>
												<span>
													{(thai && r.name_th) || r.name}
													{(thai ? r.note_th || r.note : r.note) ? <small>{thai ? r.note_th || r.note : r.note}</small> : null}
												</span>
												<b>{formatPrice(item, thai ? 'th' : 'en')}</b>
											</li>
										);
									})}
								</ul>
							</div>
						);
					})
				)}
			</section>
		</div>
	);
}
