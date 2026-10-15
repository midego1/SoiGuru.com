import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/soiguru/icon';
import { TileMap, type MapPin } from '@/components/soiguru/tile-map';
import { BackBar, BottomNav, ListingCard, SampleNotice, SearchBar, SectionHeading } from '@/components/soiguru/parts';
import { getCategories, getCity, getCityListings } from '@/lib/soiguru/content';
import { categoryName, getSgContext, listingPath, listingTitle, localName, otherName } from '@/lib/soiguru/context';
import { directionsHref } from '@/lib/soiguru/format';
import { cityNow } from '@/lib/soiguru/hours';
import { matchesQuery, rankListings, SORT_KEYS, type SortKey } from '@/lib/soiguru/query';
import type { City, ListingCategory } from '@/lib/soiguru/types';

/**
 * CategoryResults (`/krabi/nail-salons`, `/krabi/ao-nang`, `/krabi/search?q=`).
 * One URL, two modes (`?view=map`); every filter lives in the query string
 * (`?area=ao-nang&open=1&sort=nearest`) so results can be shared. No client
 * script: chips are links, the area and sort pickers are <details> menus.
 */

const PAGE_SIZE = 20;

type Params = Promise<{ locale: string; city: string; segment: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

interface Scope {
	city: City;
	category?: ListingCategory;
	/** Area fixed by the path (`/krabi/ao-nang`). */
	pathArea?: string;
	search: boolean;
}

async function resolveScope(cityId: string, segment: string): Promise<Scope | null> {
	const [city, categories] = await Promise.all([getCity(cityId), getCategories()]);
	if (!city) return null;
	if (segment === 'search') return { city, search: true };
	const category = categories.find((c) => c.id === segment);
	if (category) return { city, category, search: false };
	if (city.areas.some((a) => a.id === segment)) return { city, pathArea: segment, search: false };
	return null;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale, city: cityId, segment } = await params;
	const [ctx, scope] = await Promise.all([getSgContext(locale), resolveScope(cityId, segment)]);
	if (!scope) return {};
	const what = scope.category ? categoryName(ctx, scope.category) : ctx.t('results.everything');
	const area = scope.city.areas.find((a) => a.id === scope.pathArea);
	const place = area ? `${localName(ctx, area)}, ${localName(ctx, scope.city)}` : localName(ctx, scope.city);
	const path = `/${scope.city.id}/${segment}`;
	return {
		title: { absolute: ctx.t('results.metaTitle', { what, place }) },
		description: ctx.t('results.metaDescription', { what, place }),
		alternates: { canonical: ctx.href(path), languages: { en: path, th: `/th${path}` } },
		robots: scope.search ? { index: false, follow: true } : undefined
	};
}

export default async function CategoryResultsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale, city: cityId, segment } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const [ctx, scope] = await Promise.all([getSgContext(locale), resolveScope(cityId, segment)]);
	if (!scope) notFound();
	const { city, category } = scope;
	const listings = await getCityListings(city.id);

	// ── Filters from the URL ──────────────────────────────────────────────
	const q = one(sp.q)?.slice(0, 80) ?? '';
	const areaId = scope.pathArea ?? (city.areas.some((a) => a.id === one(sp.area)) ? one(sp.area) : undefined);
	const area = city.areas.find((a) => a.id === areaId);
	const sortParam = one(sp.sort) as SortKey | undefined;
	const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'nearest';
	// "Open now" is on by default between 09:00 and 23:00 local time (FilterBar spec).
	const { minutes } = cityNow();
	const openDefault = minutes >= 9 * 60 && minutes < 23 * 60;
	const openOnly = one(sp.open) === undefined ? openDefault : one(sp.open) === '1';
	const showClosed = one(sp.closed) === '1';
	const view = one(sp.view) === 'map' ? 'map' : 'list';
	const limit = Math.min(200, Math.max(PAGE_SIZE, Number(one(sp.limit)) || PAGE_SIZE));

	const origin = area?.geo ?? city.areas.find((a) => a.id === city.defaultArea)?.geo ?? city.geo;
	const ranked = rankListings(
		listings.filter(
			(l) => (!category || l.category.id === category.id) && (!areaId || l.area === areaId) && matchesQuery(l, q)
		),
		{ origin, sort }
	);
	const open = ranked.filter((r) => r.open);
	const closed = ranked.filter((r) => !r.open);
	const visible = (openOnly ? (showClosed ? [...open, ...closed] : open) : ranked).slice(0, limit);
	const hasMore = (openOnly ? (showClosed ? ranked.length : open.length) : ranked.length) > limit;
	const selectedSlug = one(sp.sel);
	const selected = visible.find((r) => r.listing.slug === selectedSlug) ?? (view === 'map' ? visible[0] : undefined);

	// ── Links ─────────────────────────────────────────────────────────────
	const basePath = `/${city.id}/${segment}`;
	const state: Record<string, string | undefined> = {
		q: q || undefined,
		area: scope.pathArea ? undefined : areaId,
		open: one(sp.open),
		sort: sort === 'nearest' ? undefined : sort,
		view: view === 'map' ? 'map' : undefined,
		closed: showClosed ? '1' : undefined
	};
	const link = (overrides: Record<string, string | undefined>, path = basePath) => {
		const merged = { ...state, ...overrides };
		const qs = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1])).toString();
		return ctx.href(qs ? `${path}?${qs}` : path);
	};
	const areaLink = (id?: string) =>
		scope.pathArea ? link({ area: undefined }, id ? `/${city.id}/${id}` : `/${city.id}/search`) : link({ area: id });

	// ── Labels ────────────────────────────────────────────────────────────
	const cityName = localName(ctx, city);
	const placeName = area ? localName(ctx, area) : cityName;
	const title = category
		? [categoryName(ctx, category), otherName(ctx, category)].filter(Boolean).join(' · ')
		: area && !scope.search
			? [localName(ctx, area), otherName(ctx, area)].filter(Boolean).join(' · ')
			: ctx.t('results.searchTitle');
	const subtitle = category ? placeName : cityName;
	const sortLabel = { nearest: ctx.t('results.nearest'), 'top-rated': ctx.t('results.topRated'), recent: ctx.t('results.recent') };
	const areaCounts = new Map<string, number>();
	for (const l of listings) if (!category || l.category.id === category.id) areaCounts.set(l.area, (areaCounts.get(l.area) ?? 0) + 1);

	const pins: MapPin[] = visible
		.filter((r) => r.listing.geo)
		.map((r) => ({
			id: r.listing.slug,
			geo: r.listing.geo!,
			label: listingTitle(ctx, r.listing),
			href: link({ sel: r.listing.slug }),
			selected: r.listing.slug === selected?.listing.slug
		}));

	const filterBar = (
		<div className="tkg-filterbar">
			<div className="tkg-seg">
				<Link href={link({ view: undefined })} className={view === 'list' ? 'tkg-on' : undefined}>
					<Icon name="list" />
					{ctx.t('results.list')}
				</Link>
				<Link href={link({ view: 'map' })} className={view === 'map' ? 'tkg-on' : undefined}>
					<Icon name="map" />
					{ctx.t('results.map')}
				</Link>
			</div>
			<Link className={openOnly ? 'tkg-chip tkg-chip-on' : 'tkg-chip'} href={link({ open: openOnly ? '0' : '1', closed: undefined })} aria-pressed={openOnly}>
				<Icon name="clock" />
				{ctx.t('results.openNow')}
			</Link>
			{city.areas.length ? (
				<details className="sg-pop">
					<summary className={area ? 'tkg-chip tkg-chip-on' : 'tkg-chip'}>
						{area ? localName(ctx, area) : ctx.t('results.allAreas')} <Icon name="chevron-down" />
					</summary>
					<div className="sg-pop-menu">
						<Link href={areaLink(undefined)} aria-current={!area ? 'true' : undefined}>
							{ctx.t('results.allAreas')}
						</Link>
						{city.areas.map((a) => (
							<Link key={a.id} href={areaLink(a.id)} aria-current={a.id === areaId ? 'true' : undefined}>
								{localName(ctx, a)}
								<small>
									{[otherName(ctx, a), String(areaCounts.get(a.id) ?? 0)].filter(Boolean).join(' · ')}
								</small>
							</Link>
						))}
					</div>
				</details>
			) : null}
			<details className="sg-pop">
				<summary className="tkg-chip">
					{sortLabel[sort]} <Icon name="chevron-down" />
				</summary>
				<div className="sg-pop-menu">
					{SORT_KEYS.map((k) => (
						<Link key={k} href={link({ sort: k === 'nearest' ? undefined : k })} aria-current={k === sort ? 'true' : undefined}>
							{sortLabel[k]}
						</Link>
					))}
				</div>
			</details>
		</div>
	);

	const heading = openOnly ? (
		<SectionHeading
			title={ctx.t('results.openHeading', { count: open.length })}
			sub={ctx.t('results.ofTotal', { total: ranked.length, place: placeName })}
		/>
	) : (
		<SectionHeading title={ctx.t('results.totalHeading', { count: ranked.length })} sub={ctx.t('results.inPlace', { place: placeName })} />
	);

	const list = (
		<div className="tkg-section" style={{ paddingTop: 16 }}>
			{q ? <p className="tkg-small tkg-muted tkg-pad" style={{ margin: '0 0 4px' }}>{ctx.t('results.resultsFor', { q })}</p> : null}
			{heading}
			{visible.length ? (
				<div className="tkg-list">
					{visible.map((item) => (
						<ListingCard
							key={item.listing.slug}
							ctx={ctx}
							city={city}
							item={item}
							subline={category ? 'address' : 'category'}
							selected={item.listing.slug === selected?.listing.slug}
							showCount
						/>
					))}
				</div>
			) : (
				<p className="tkg-info">
					<Icon name="info" />
					<span>{ctx.t('results.empty')}</span>
				</p>
			)}
			<div className="tkg-pad" style={{ display: 'grid', gap: 8, paddingTop: 12, paddingBottom: 16 }}>
				{openOnly && !showClosed && closed.length ? (
					<Link className="tkg-btn tkg-btn-secondary tkg-btn-block" href={link({ closed: '1' })}>
						{ctx.t('results.showClosed', { count: closed.length })}
					</Link>
				) : null}
				{hasMore ? (
					<Link className="tkg-btn tkg-btn-ghost tkg-btn-block" href={link({ limit: String(limit + PAGE_SIZE) })}>
						{ctx.t('results.showMore')}
					</Link>
				) : null}
			</div>
		</div>
	);

	const sheet = selected ? (
		<div className="sg-map-sheet">
			<div className="sg-grabber" />
			<ListingCard ctx={ctx} city={city} item={selected} compact />
			<div className="sg-map-actions">
				{selected.listing.geo ? (
					<a className="tkg-btn tkg-btn-sm" href={directionsHref(selected.listing.geo)} target="_blank" rel="noopener">
						<Icon name="navigation" />
						{ctx.t('results.directions')}
					</a>
				) : null}
				<Link className="tkg-btn tkg-btn-secondary tkg-btn-sm" href={ctx.href(listingPath(selected.listing))}>
					{ctx.t('results.viewListing')}
				</Link>
			</div>
		</div>
	) : null;

	const attribution = (
		<div className="sg-map-foot tkg-small tkg-muted">
			{openOnly ? `${ctx.t('results.openHeading', { count: open.length })} · ` : ''}
			{ctx.t('results.attribution')}
		</div>
	);

	return (
		<div className="sg-page sg-results-page">
			<BackBar ctx={ctx} backHref={ctx.href(`/${city.id}`)} title={title} subtitle={subtitle} city={city.id} active="search">
				<Link className="tkg-iconbtn" href={ctx.href(`/${city.id}/search`)} aria-label={ctx.t('results.searchTitle')}>
					<Icon name="search" />
				</Link>
			</BackBar>
			{scope.search ? (
				<div style={{ background: 'var(--surface)', padding: '12px 16px 0' }}>
					<SearchBar ctx={ctx} city={city} defaultValue={q} />
				</div>
			) : null}
			{filterBar}
			{listings.some((l) => l.sample) ? <SampleNotice ctx={ctx} /> : null}
			<div className="sg-results-body sg-grow">
				<div className="sg-results-list">
					{view === 'map' ? (
						<div className="sg-results-map-inline">
							<TileMap pins={pins} height={560} fallbackCenter={origin} you={origin}>
								{sheet}
							</TileMap>
							{attribution}
						</div>
					) : (
						<>
							<div className="sg-results-map-inline">
								<TileMap pins={pins} height={150} fallbackCenter={origin} you={origin}>
									<Link className="tkg-map-pill" href={link({ view: 'map' })}>
										<Icon name="map" />
										{ctx.t('results.showMap')}
									</Link>
								</TileMap>
							</div>
							{list}
						</>
					)}
					{view === 'map' ? <div className="sg-results-dock-list">{list}</div> : null}
				</div>
				<div className="sg-results-map-dock">
					<TileMap pins={pins} height={720} fitWidth={540} fallbackCenter={origin} you={origin} />
					{attribution}
				</div>
			</div>
			<BottomNav ctx={ctx} city={city.id} active="search" />
		</div>
	);
}

