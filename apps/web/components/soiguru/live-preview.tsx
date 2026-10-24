'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from './icon';
import { SoiGuruLogo } from './logo-mark';
import { formatPriceBand, formatThaiPhone } from '@/lib/soiguru/format';
import { formatRanges, getOpenStatus, type OpenStatus } from '@/lib/soiguru/hours';
import {
	applyFormToPreview,
	formEntries,
	hasAnyHours,
	isDirty,
	previewHoursRows,
	type AmenityNames,
	type PreviewCategory,
	type PreviewListing
} from '@/lib/soiguru/live-preview';
import { formatPrice } from '@/lib/soiguru/menu';
import './live-preview.css';

/**
 * Live preview of an owner edit page (spec 074): the listing as visitors see it on soiguru.com,
 * fed by the form's current, unsaved values. From 1100px it sits beside the form (form 60%,
 * preview 40%) in a sticky panel; below that the "Preview" button in the top bar opens it in a
 * full-screen dialog. The page is drawn at phone width (390px) in a phone frame scaled to fit,
 * or at 1024px with "Desktop". Buttons inside the preview don't do anything.
 *
 * `LivePreview` reads the enclosing `<form>` (none on the photos page: it then shows the saved
 * listing) on every input, change, click and added/removed row, 150ms debounced, and overlays it
 * on `base` with `applyFormToPreview`, the save actions' rules.
 */

export type PreviewSection = 'photos' | 'title' | 'contact' | 'where' | 'hours' | 'menu' | 'about' | 'amenities';
type Mode = 'phone' | 'desktop';

const OPEN_EVENT = 'sg-preview:open';
const WIDE_QUERY = '(min-width: 1100px)';
const SCREEN_WIDTH: Record<Mode, number> = { phone: 390, desktop: 1024 };
const DEBOUNCE_MS = 150;

/** "Preview" in the edit page's top bar, below 1100px: opens the preview dialog. */
export function PreviewOpenButton() {
	const t = useTranslations('soiguru.preview');
	return (
		<button type="button" className="tkg-btn tkg-btn-secondary tkg-btn-sm sg-pv-open" onClick={openLivePreview}>
			<Icon name="image" />
			{t('open')}
		</button>
	);
}

function useIsWide(): boolean {
	const [wide, setWide] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia(WIDE_QUERY);
		const on = () => setWide(mq.matches);
		on();
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	}, []);
	return wide;
}

export function LivePreview({
	base,
	focus,
	categories,
	amenityNames
}: {
	base: PreviewListing;
	/** The sections this page edits: highlighted, and the first is scrolled into view. */
	focus: PreviewSection[];
	categories?: PreviewCategory[];
	amenityNames?: AmenityNames;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<{ data: PreviewListing; dirty: boolean }>({ data: base, dirty: false });

	// Follow the form. A new `base` (after a save) takes a fresh "saved" snapshot.
	useEffect(() => {
		setView({ data: base, dirty: false });
		const root = rootRef.current;
		const form = root?.closest('form');
		if (!root || !form) return;
		const initial = formEntries(new FormData(form));
		let last = JSON.stringify(initial);
		let timer: number | undefined;
		const run = () => {
			const current = formEntries(new FormData(form));
			const key = JSON.stringify(current);
			if (key === last) return;
			last = key;
			const dirty = isDirty(initial, current);
			setView({ data: dirty ? applyFormToPreview(base, current, { categories, amenityNames }) : base, dirty });
		};
		const schedule = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(run, DEBOUNCE_MS);
		};
		// Rows added, removed or moved in the menu editor change fields without an input event.
		const observer = new MutationObserver((records) => {
			if (records.some((r) => !root.contains(r.target))) schedule();
		});
		observer.observe(form, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['value', 'name']
		});
		form.addEventListener('input', schedule);
		form.addEventListener('change', schedule);
		form.addEventListener('click', schedule);
		return () => {
			window.clearTimeout(timer);
			observer.disconnect();
			form.removeEventListener('input', schedule);
			form.removeEventListener('change', schedule);
			form.removeEventListener('click', schedule);
		};
	}, [base, categories, amenityNames]);

	return (
		<div ref={rootRef} className="sg-pv-host">
			<PreviewSurface view={view} focus={focus} />
		</div>
	);
}

/** Opens the preview dialog (below 1100px), for a "Preview" button outside the SoiGuru shell. */
export function openLivePreview() {
	window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Where the preview shows: the sticky side panel from 1100px, else the full-screen dialog that a
 * "Preview" button opens. Client-only (rendered after mount), so the clock never mismatches.
 */
export function PreviewSurface({
	view,
	focus
}: {
	view: { data: PreviewListing; dirty: boolean };
	focus: PreviewSection[];
}) {
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);
	const wide = useIsWide();

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		const onOpen = () => setOpen(true);
		window.addEventListener(OPEN_EVENT, onOpen);
		return () => window.removeEventListener(OPEN_EVENT, onOpen);
	}, []);

	// Widening the window while the dialog is open: the side panel takes over.
	useEffect(() => {
		if (wide) setOpen(false);
	}, [wide]);

	if (!mounted) return null;
	if (wide) return <PreviewPanel view={view} focus={focus} />;
	return open ? <PreviewDialog view={view} focus={focus} onClose={() => setOpen(false)} /> : null;
}

function DirtyNote({ dirty }: { dirty: boolean }) {
	const t = useTranslations('soiguru.preview');
	return dirty ? (
		<span className="sg-pv-dirty" role="status">
			{t('notSaved')}
		</span>
	) : (
		<span className="sg-pv-clean">{t('sameAsLive')}</span>
	);
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
	const t = useTranslations('soiguru.preview');
	return (
		<span className="sg-pv-modes" role="group" aria-label={t('showAs')}>
			{(['phone', 'desktop'] as const).map((m) => (
				<button key={m} type="button" aria-pressed={mode === m} onClick={() => onChange(m)}>
					{t(m)}
				</button>
			))}
		</span>
	);
}

/** Scrolls `scroller` so the first focused section is at its top (the window doesn't move). */
function useScrollToFocus(scroller: React.RefObject<HTMLElement | null>, deps: unknown[]) {
	useLayoutEffect(() => {
		const box = scroller.current;
		const target = box?.querySelector<HTMLElement>('[data-pv-focus]');
		if (!box || !target) return;
		box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top - 32;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
}

function PreviewPanel({ view, focus }: { view: { data: PreviewListing; dirty: boolean }; focus: PreviewSection[] }) {
	const t = useTranslations('soiguru.preview');
	const [mode, setMode] = useState<Mode>('phone');
	const scrollRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);
	useScrollToFocus(scrollRef, [mode, ready]);
	return (
		<aside className="sg-pv-panel" aria-label={t('title')}>
			<div className="sg-pv-head">
				<h2>{t('title')}</h2>
				<DirtyNote dirty={view.dirty} />
				<ModeToggle mode={mode} onChange={setMode} />
			</div>
			<div className="sg-pv-scroll" ref={scrollRef}>
				<PreviewStage data={view.data} focus={focus} mode={mode} onReady={() => setReady(true)} />
				<p className="sg-pv-foot">{t('buttonsNote')}</p>
			</div>
		</aside>
	);
}

function PreviewDialog({
	view,
	focus,
	onClose
}: {
	view: { data: PreviewListing; dirty: boolean };
	focus: PreviewSection[];
	onClose: () => void;
}) {
	const t = useTranslations('soiguru.preview');
	const ref = useRef<HTMLDialogElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [mode, setMode] = useState<Mode>('phone');
	const [ready, setReady] = useState(false);
	// The page is measured once the dialog is open (a closed dialog has no width).
	const [shown, setShown] = useState(false);
	useLayoutEffect(() => {
		const d = ref.current;
		if (d && !d.open) d.showModal();
		setShown(true);
		return () => d?.close();
	}, []);
	useScrollToFocus(scrollRef, [mode, ready]);
	return (
		<dialog ref={ref} className="sg-pv-dialog" aria-label={t('title')} onClose={onClose}>
			<div className="sg-pv-head">
				<h2>{t('title')}</h2>
				<button type="button" className="tkg-iconbtn sg-pv-close" onClick={onClose} aria-label={t('close')}>
					<Icon name="close" />
				</button>
				<DirtyNote dirty={view.dirty} />
				<ModeToggle mode={mode} onChange={setMode} />
			</div>
			<div className="sg-pv-scroll" ref={scrollRef}>
				{shown ? (
					<PreviewStage data={view.data} focus={focus} mode={mode} onReady={() => setReady(true)} />
				) : null}
				<p className="sg-pv-foot">{t('buttonsNote')}</p>
			</div>
		</dialog>
	);
}

/** The device frame: the page at its real width, zoomed down to the space there is. */
function PreviewStage({
	data,
	focus,
	mode,
	onReady
}: {
	data: PreviewListing;
	focus: PreviewSection[];
	mode: Mode;
	onReady?: () => void;
}) {
	const stageRef = useRef<HTMLDivElement>(null);
	const [zoom, setZoom] = useState<number | null>(null);
	const width = SCREEN_WIDTH[mode];
	const fit = useCallback(() => {
		const el = stageRef.current;
		if (!el) return;
		// 2 × (8px bezel + 1px border) around the screen.
		const room = el.clientWidth - 18;
		setZoom(Math.max(0.2, Math.min(1, room / width)));
	}, [width]);
	useLayoutEffect(() => {
		fit();
		const el = stageRef.current;
		if (!el) return;
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		return () => ro.disconnect();
	}, [fit]);
	useEffect(() => {
		if (zoom !== null) onReady?.();
	}, [zoom, onReady]);
	return (
		<div className="sg-pv-stage" ref={stageRef}>
			{zoom !== null ? (
				<div className="sg-pv-device" data-mode={mode}>
					<div className="sg-pv-screen" style={{ width, zoom }}>
						<ListingPreview data={data} focus={focus} mode={mode} />
					</div>
				</div>
			) : null}
		</div>
	);
}

function useStatusText() {
	const t = useTranslations('soiguru');
	return (s: OpenStatus): string => {
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
	};
}

const STATUS_CLASS: Record<OpenStatus['state'], string> = {
	open: 'tkg-status tkg-status-open',
	soon: 'tkg-status tkg-status-soon',
	opens: 'tkg-status tkg-status-soon',
	closed: 'tkg-status tkg-status-closed',
	unknown: 'tkg-status tkg-status-unknown'
};

/** The clock ticks once a minute, so the open status and "today" stay right. */
function useMinute(): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = window.setInterval(() => setNow(new Date()), 60_000);
		return () => window.clearInterval(id);
	}, []);
	return now;
}

interface SectionProps {
	id: PreviewSection;
	focus: PreviewSection[];
	labels: { editing: string; empty: string };
	className?: string;
	children?: React.ReactNode;
	/** Nothing to show: hidden like on the public page, or a placeholder when this page edits it. */
	empty?: boolean;
}

/** One block of the preview; outlined with "You're editing this" when the page edits it. */
function PvSection({ id, focus, labels, className, children, empty }: SectionProps) {
	const focused = focus.includes(id);
	if (empty && !focused) return null;
	return (
		<div
			className={`sg-pv-sec${className ? ` ${className}` : ''}${focused ? ' sg-pv-focused' : ''}`}
			data-pv={id}
			{...(id === focus[0] ? { 'data-pv-focus': '' } : {})}
		>
			{focused ? <span className="sg-pv-tag">{labels.editing}</span> : null}
			{empty ? <p className="sg-pv-empty">{labels.empty}</p> : children}
		</div>
	);
}

/**
 * The public listing page (`astro/apps/web/src/pages/[city]/[area]/[slug].astro`) drawn from
 * preview data: photos, category chip, name, open status, contact buttons, where, hours, menu,
 * about and good to know. Visual only; nothing in it is a link.
 */
export function ListingPreview({
	data,
	focus = [],
	mode = 'phone'
}: {
	data: PreviewListing;
	focus?: PreviewSection[];
	mode?: Mode;
}) {
	const t = useTranslations('soiguru');
	const thai = useLocale() === 'th';
	const now = useMinute();
	const statusText = useStatusText();
	const status = getOpenStatus(data.hours, now);
	const price = formatPriceBand(data.priceBand);
	const lang = thai ? 'th' : 'en';
	const sectionLabels = { editing: t('preview.editing'), empty: t('preview.emptySection') };

	const actions = [
		data.phone && { key: 'call', icon: 'phone', label: t('preview.call'), cls: 'sg-pv-act-call' },
		data.lineId && { key: 'line', icon: 'chat', label: 'LINE', cls: 'sg-pv-act-line' },
		data.whatsapp && { key: 'wa', icon: 'chat', label: 'WhatsApp', cls: 'sg-pv-act-wa' },
		data.hasGeo && { key: 'dir', icon: 'navigation', label: t('listing.directions'), cls: 'sg-pv-act-dir' }
	].filter((a): a is { key: string; icon: string; label: string; cls: string } => !!a);
	const facts = [
		formatThaiPhone(data.phone),
		data.lineId ? `LINE ${data.lineId}` : undefined,
		data.bookingNote
	].filter(Boolean);
	const shown = data.images.slice(0, mode === 'desktop' ? 5 : 3);
	const category = (thai && data.category.name_th) || data.category.name;
	const about = (thai ? [data.descriptionTh, data.description] : [data.description, data.descriptionTh]).filter(
		(x): x is string => !!x
	);

	return (
		<div className="sg-pv-page" data-mode={mode}>
			<div className="sg-pv-site">
				<span className="sg-pv-logo-light">
					<SoiGuruLogo height={22} />
				</span>
				<span className="sg-pv-logo-dark">
					<SoiGuruLogo height={22} tone="dark" />
				</span>
			</div>
			<div className="sg-pv-wrap">
				<PvSection focus={focus} labels={sectionLabels} id="photos" className="sg-pv-photos">
					{shown.length ? (
						<div className="sg-pv-pgrid" data-count={shown.length}>
							{shown.map((src, i) => (
								// Plain <img>: owner photos come from arbitrary hosts.
								<img key={`${src}-${i}`} src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
							))}
							<span className="sg-pv-pcount">
								<Icon name="camera" className="tkg-i-16" />
								{t('listing.photos', { count: data.images.length })}
							</span>
						</div>
					) : (
						<div className="sg-pv-nophoto">
							<Icon name="camera" className="tkg-i-24" />
							<span>{t('preview.noPhotos')}</span>
						</div>
					)}
				</PvSection>

				<div className="sg-pv-grid">
					<div className="sg-pv-headcol">
						<PvSection focus={focus} labels={sectionLabels} id="title">
							<div className="sg-pv-chips">
								<span className="sg-pv-chip sg-pv-chip-sea">{category}</span>
								{data.claimed ? (
									<span className="sg-pv-chip sg-pv-chip-ink">
										<Icon name="check" className="tkg-i-16" />
										{t('listing.verified')}
									</span>
								) : null}
							</div>
							<h1 className="sg-pv-title">{data.name}</h1>
							{data.nameTh ? (
								<p className="sg-pv-th" lang="th">
									{data.nameTh}
								</p>
							) : null}
							<p className="sg-pv-meta">
								<span className={`${STATUS_CLASS[status.state]} tkg-status-lg`}>
									{statusText(status)}
								</span>
								{data.rating !== undefined ? (
									<span className="tkg-rating">
										<Icon name="star" />
										{data.rating.toFixed(1)}
										{data.ratingCount !== undefined ? (
											<span className="tkg-muted"> ({data.ratingCount})</span>
										) : null}
									</span>
								) : null}
								{price ? <span>{price}</span> : null}
								{data.areaName ? (
									<span>
										<Icon name="pin" className="tkg-i-16" /> {data.areaName}
									</span>
								) : null}
							</p>
						</PvSection>
						<PvSection
							focus={focus}
							labels={sectionLabels}
							id="contact"
							empty={actions.length === 0 && facts.length === 0}
						>
							{actions.length ? (
								<div className="sg-pv-actions">
									{actions.map((a, i) => (
										<span
											key={a.key}
											className={`sg-pv-act ${a.cls}${i === 0 ? ' sg-pv-act-primary' : ''}`}
										>
											<Icon name={a.icon} />
											{a.label}
										</span>
									))}
								</div>
							) : null}
							{facts.length ? <p className="sg-pv-facts">{facts.join(' · ')}</p> : null}
						</PvSection>
					</div>

					<div className="sg-pv-side">
						<PvSection
							focus={focus}
							labels={sectionLabels}
							id="where"
							className="sg-pv-card"
							empty={!data.address && !data.hasGeo}
						>
							{data.hasGeo ? (
								<div className="sg-pv-map" aria-hidden="true">
									<Icon name="pin" className="tkg-i-24" />
								</div>
							) : null}
							{data.address ? <p className="sg-pv-address">{data.address}</p> : null}
							<div className="sg-pv-where-btns">
								<span className="sg-pv-btn sg-pv-btn-sea">
									<Icon name="navigation" className="tkg-i-16" />
									Google Maps
								</span>
								<span className="sg-pv-btn">
									<Icon name="map" className="tkg-i-16" />
									Apple Maps
								</span>
							</div>
						</PvSection>
						<PvSection focus={focus} labels={sectionLabels} id="hours" className="sg-pv-card">
							<h2 className="sg-pv-card-h">{t('preview.hoursTitle')}</h2>
							{data.hoursNote ? <p className="sg-pv-card-note">{data.hoursNote}</p> : null}
							{hasAnyHours(data.hours) ? (
								<table className="tkg-hours">
									<tbody>
										{previewHoursRows(data.hours, now).map((row) => (
											<tr key={row.day} className={row.today ? 'tkg-today' : undefined}>
												<td>
													{t(`days.${row.day}`)}
													{row.today ? ` · ${t('listing.today')}` : ''}
												</td>
												{row.ranges === null ? (
													<td className="tkg-muted">–</td>
												) : row.ranges.length === 0 ? (
													<td className="tkg-closed-day">{t('listing.closed')}</td>
												) : (
													<td>
														{formatRanges(row.ranges).map((r) => (
															<span key={r} className="sg-pv-range">
																{r === '24h' ? t('status.open24') : r}
															</span>
														))}
													</td>
												)}
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<p className="sg-pv-card-text">{t('preview.hoursUnknown')}</p>
							)}
						</PvSection>
					</div>

					<div className="sg-pv-body">
						<PvSection focus={focus} labels={sectionLabels} id="menu" empty={data.menu.length === 0}>
							<h2 className="sg-pv-h">{t('preview.menuTitle')}</h2>
							{data.menu.map((s, si) => (
								<div key={si} className="sg-pv-menu-group">
									{s.title || s.title_th ? (
										<h3 className="sg-pv-menu-title">
											{(thai && s.title_th) || s.title || s.title_th}
										</h3>
									) : null}
									<ul className="sg-pv-menu-list">
										{s.items.map((item, ii) => {
											const p = formatPrice(item, lang);
											const note = (thai && item.note_th) || item.note;
											return (
												<li key={ii} className="sg-pv-menu-item">
													<span className="sg-pv-menu-name">
														<span>{(thai && item.name_th) || item.name}</span>
														{note ? <small>{note}</small> : null}
													</span>
													{p ? <span className="sg-pv-menu-price">{p}</span> : null}
												</li>
											);
										})}
									</ul>
								</div>
							))}
							{data.menuNote || data.menuNoteTh ? (
								<p className="sg-pv-menu-foot">
									{(thai && data.menuNoteTh) || data.menuNote || data.menuNoteTh}
								</p>
							) : null}
						</PvSection>
						<PvSection focus={focus} labels={sectionLabels} id="about" empty={about.length === 0}>
							<h2 className="sg-pv-h">{t('listing.about')}</h2>
							{about.map((text, i) => (
								<p
									key={i}
									className={`sg-pv-prose${i > 0 ? ' tkg-muted' : ''}`}
									lang={(i === 0) === thai ? 'th' : 'en'}
								>
									{text}
								</p>
							))}
						</PvSection>
						<PvSection
							focus={focus}
							labels={sectionLabels}
							id="amenities"
							empty={data.amenities.length === 0}
						>
							<h2 className="sg-pv-h">{t('listing.goodToKnow')}</h2>
							<ul className="sg-pv-pills">
								{data.amenities.map((a) => {
									const name = (thai && a.name_th) || a.name;
									return a.available ? (
										<li key={a.id}>
											<Icon name="check" className="tkg-i-16" />
											{name}
										</li>
									) : (
										<li key={a.id} className="sg-pv-pill-no">
											<Icon name="close" className="tkg-i-16" />
											{t('preview.noAmenity', {
												name: thai ? name : name.charAt(0).toLowerCase() + name.slice(1)
											})}
										</li>
									);
								})}
							</ul>
						</PvSection>
					</div>
				</div>
			</div>
		</div>
	);
}
