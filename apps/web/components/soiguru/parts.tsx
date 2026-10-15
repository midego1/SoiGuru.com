/**
 * SoiGuru screen building blocks, ported 1:1 from the TheKrabiGuide design
 * system (`tkg-` classes in app/[locale]/(soiguru)/soiguru.css). Server
 * components only: every interaction is a link or a GET form, so the screens
 * paint before any script runs.
 */
import Link from 'next/link';
import { Icon } from './icon';
import {
	categoryName,
	listingOtherName,
	listingPath,
	listingTitle,
	localName,
	otherName,
	statusClass,
	statusText,
	type SgContext
} from '@/lib/soiguru/context';
import { formatDistance, formatPriceBand } from '@/lib/soiguru/format';
import { isNew, type RankedListing } from '@/lib/soiguru/query';
import type { City, ListingCategory } from '@/lib/soiguru/types';

/* ── Top bar ─────────────────────────────────────────────────────────────── */

type NavKey = 'home' | 'search' | 'saved' | 'owner';

function navItems(ctx: SgContext, city: string) {
	return [
		{ key: 'home', icon: 'home', href: ctx.href(`/${city}`) },
		{ key: 'search', icon: 'search', href: ctx.href(`/${city}/search`) },
		{ key: 'saved', icon: 'heart', href: ctx.href('/favorites') },
		{ key: 'owner', icon: 'user', href: ctx.href('/owner') }
	] as const;
}

/**
 * The bottom tab bar's destinations as inline top-bar links. Hidden on phones
 * (the tab bar carries them there) and shown from 960px, where the tab bar is hidden.
 */
function DeskNav({ ctx, city, active }: { ctx: SgContext; city: string; active?: NavKey }) {
	return (
		<nav className="sg-desk-nav">
			{navItems(ctx, city).map((i) => (
				<Link
					key={i.key}
					href={i.href}
					className={active === i.key ? 'tkg-on' : undefined}
					aria-current={active === i.key ? 'page' : undefined}
				>
					<Icon name={i.icon} />
					{ctx.t(`nav.${i.key}`)}
				</Link>
			))}
		</nav>
	);
}

/** Brand row: fixed "SoiGuru" wordmark, the city as a separate label. */
export function BrandBar({
	ctx,
	city,
	langPath,
	active
}: {
	ctx: SgContext;
	city?: City;
	langPath: string;
	active?: NavKey;
}) {
	return (
		<header className="tkg-topbar">
			<Link className="tkg-brand" href={ctx.href('/')}>
				SoiGuru
			</Link>
			{city ? (
				<Link className="sg-brand-city" href={ctx.href(`/${city.id}`)}>
					{localName(ctx, city)}
				</Link>
			) : null}
			<div className="tkg-spacer" />
			{city ? <DeskNav ctx={ctx} city={city.id} active={active} /> : null}
			<LanguageToggle ctx={ctx} path={langPath} />
			<Link className="tkg-iconbtn" href={ctx.href('/')} aria-label={ctx.t('allCities')}>
				<Icon name="menu" />
			</Link>
		</header>
	);
}

/** Back-arrow bar used on results and listing pages. */
export function BackBar({
	backHref,
	title,
	subtitle,
	ctx,
	city,
	active,
	children
}: {
	backHref: string;
	title: string;
	subtitle?: string;
	ctx: SgContext;
	/** On wide screens the bar also shows the brand and the tab destinations. */
	city?: string;
	active?: NavKey;
	children?: React.ReactNode;
}) {
	return (
		<header className="tkg-topbar">
			<Link className="tkg-brand sg-desk-only" href={ctx.href('/')}>
				SoiGuru
			</Link>
			<Link className="tkg-iconbtn" href={backHref} aria-label={ctx.t('results.back')}>
				<Icon name="chevron-left" />
			</Link>
			<div className="sg-bar-title">
				{title}
				{subtitle ? <small>{subtitle}</small> : null}
			</div>
			{children}
			{city ? <DeskNav ctx={ctx} city={city} active={active} /> : null}
		</header>
	);
}

/** EN / ไทย. The UI language lives in the URL (`/th/...`), so it is a pair of links. */
export function LanguageToggle({ ctx, path }: { ctx: SgContext; path: string }) {
	const enHref = path;
	const thHref = `/th${path === '/' ? '' : path}`;
	return (
		<nav className="tkg-lang" aria-label={ctx.t('language')}>
			<Link
				href={enHref}
				className={ctx.thai ? undefined : 'tkg-on'}
				hrefLang="en"
				aria-current={ctx.thai ? undefined : 'true'}
			>
				EN
			</Link>
			<Link
				href={thHref}
				className={ctx.thai ? 'tkg-on' : undefined}
				hrefLang="th"
				aria-current={ctx.thai ? 'true' : undefined}
			>
				ไทย
			</Link>
		</nav>
	);
}

export function BottomNav({ ctx, city, active }: { ctx: SgContext; city: string; active: NavKey }) {
	return (
		<nav className="tkg-nav">
			{navItems(ctx, city).map((i) => (
				<Link
					key={i.key}
					href={i.href}
					className={active === i.key ? 'tkg-on' : undefined}
					aria-current={active === i.key ? 'page' : undefined}
				>
					<Icon name={i.icon} />
					{ctx.t(`nav.${i.key}`)}
				</Link>
			))}
		</nav>
	);
}

/* ── Search, chips, tiles ───────────────────────────────────────────────── */

export function SearchBar({ ctx, city, defaultValue }: { ctx: SgContext; city: City; defaultValue?: string }) {
	const label = ctx.t('home.searchLabel', { city: localName(ctx, city) });
	return (
		<form className="tkg-search" action={ctx.href(`/${city.id}/search`)} method="get" role="search">
			<Icon name="search" />
			<input
				type="search"
				name="q"
				defaultValue={defaultValue}
				placeholder={ctx.t('home.searchPlaceholder')}
				aria-label={label}
			/>
			<button className="tkg-search-btn" type="submit">
				{ctx.t('home.search')}
			</button>
		</form>
	);
}

export function Chip({
	href,
	on,
	icon,
	children,
	small
}: {
	href: string;
	on?: boolean;
	icon?: string;
	children: React.ReactNode;
	small?: string;
}) {
	return (
		<Link className={on ? 'tkg-chip tkg-chip-on' : 'tkg-chip'} href={href} aria-current={on ? 'true' : undefined}>
			{icon ? <Icon name={icon} /> : null}
			{children}
			{small ? <small>{small}</small> : null}
		</Link>
	);
}

export function CategoryGrid({
	ctx,
	city,
	categories
}: {
	ctx: SgContext;
	city: string;
	categories: ListingCategory[];
}) {
	return (
		<div className="tkg-cats">
			{categories.map((c) => (
				<Link key={c.id} className="tkg-cat" href={ctx.href(`/${city}/${c.id}`)}>
					<Icon name={c.icon} />
					{categoryName(ctx, c)}
					{otherName(ctx, c) ? <small>{otherName(ctx, c)}</small> : null}
				</Link>
			))}
		</div>
	);
}

export function SectionHeading({
	title,
	sub,
	link
}: {
	title: string;
	sub?: string;
	link?: { href: string; label: string };
}) {
	return (
		<div className="tkg-section-h">
			<h2>
				{title}
				{sub ? <small>{sub}</small> : null}
			</h2>
			{link ? <Link href={link.href}>{link.label}</Link> : null}
		</div>
	);
}

/* ── Listing card ───────────────────────────────────────────────────────── */

/** No photo: `surface-200` with the category icon, never a stock image (ListingCard spec). */
export function Thumb({ src, icon }: { src?: string; icon: string }) {
	if (src) {
		// Plain <img>: owner photos come from arbitrary hosts.
		return <img className="tkg-photo sg-thumb" src={src} alt="" loading="lazy" decoding="async" />;
	}
	return (
		<div className="tkg-photo sg-thumb-empty">
			<Icon name={icon} className="tkg-i-24" />
		</div>
	);
}

export function Rating({ value, count }: { value?: number; count?: number }) {
	if (value === undefined) return null;
	return (
		<span className="tkg-rating">
			<Icon name="star" />
			{value.toFixed(1)}
			{count !== undefined ? (
				<span className="tkg-muted" style={{ fontWeight: 400 }}>
					{' '}
					({count})
				</span>
			) : null}
		</span>
	);
}

interface ListingCardProps {
	ctx: SgContext;
	city: City;
	item: RankedListing;
	compact?: boolean;
	selected?: boolean;
	/** Second line: the street address instead of category · area. */
	subline?: 'category' | 'address';
	showCount?: boolean;
}

export function ListingCard({ ctx, city, item, compact, selected, subline = 'category', showCount }: ListingCardProps) {
	const { listing: l, status, distance } = item;
	const area = city.areas.find((a) => a.id === l.area);
	const other = listingOtherName(ctx, l);
	const sub =
		subline === 'address'
			? [other, l.address].filter(Boolean).join(' · ')
			: [other, categoryName(ctx, l.category), area ? localName(ctx, area) : l.area].filter(Boolean).join(' · ');
	const price = formatPriceBand(l.priceBand);
	const cls = ['tkg-card', compact ? 'tkg-card-compact' : '', selected ? 'tkg-card-selected' : '']
		.filter(Boolean)
		.join(' ');
	return (
		<Link className={cls} href={ctx.href(listingPath(l))}>
			<Thumb src={l.images[0]} icon={l.category.icon} />
			<div className="tkg-card-body">
				<div className="tkg-card-title" style={compact ? { fontSize: 15, lineHeight: '22px' } : undefined}>
					<span className="tkg-name">{listingTitle(ctx, l)}</span>
					{l.claimed ? (
						<span className="tkg-badge" title={ctx.t('listing.verified')}>
							<Icon name="shield" />
							<span className="sr-only">{ctx.t('listing.verified')}</span>
						</span>
					) : null}
				</div>
				{compact ? null : <div className="tkg-card-sub">{sub}</div>}
				<span className={statusClass(status)}>{statusText(ctx, status)}</span>
				<div className="tkg-card-meta">
					<Rating value={l.rating} count={showCount ? l.ratingCount : undefined} />
					{distance !== undefined ? (
						<span className="tkg-dot">
							{formatDistance(distance)}
							{area?.boat ? ` · ${ctx.t('results.boat')}` : ''}
						</span>
					) : null}
					{price && !compact ? <span className="tkg-dot">{price}</span> : null}
					{isNew(l) && !compact ? (
						<span className="tkg-badge tkg-badge-sun" style={{ marginLeft: 4 }}>
							{ctx.t('results.new')}
						</span>
					) : null}
				</div>
			</div>
		</Link>
	);
}

/** A row of compact cards for "Nearby" (rows separated by `line`). */
export function CompactList({ ctx, city, items }: { ctx: SgContext; city: City; items: RankedListing[] }) {
	return (
		<div className="tkg-rows">
			{items.map((i) => (
				<ListingCard key={i.listing.slug} ctx={ctx} city={city} item={i} compact />
			))}
		</div>
	);
}

/** Shown on every page while the content is SAMPLE data. */
export function SampleNotice({ ctx }: { ctx: SgContext }) {
	return (
		<p className="tkg-info sg-sample" role="note">
			<Icon name="info" />
			<span>{ctx.t('sampleBanner')}</span>
		</p>
	);
}
