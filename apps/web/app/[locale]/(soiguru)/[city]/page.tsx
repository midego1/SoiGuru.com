import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/soiguru/icon';
import {
	BottomNav,
	BrandBar,
	CategoryGrid,
	Chip,
	ListingCard,
	SampleNotice,
	SearchBar,
	SectionHeading
} from '@/components/soiguru/parts';
import { getCategories, getCity, getCityListings } from '@/lib/soiguru/content';
import { getSgContext, localName, otherName } from '@/lib/soiguru/context';
import { cityNow, formatMinutes } from '@/lib/soiguru/hours';
import { rankListings } from '@/lib/soiguru/query';

/**
 * CityHome (`/krabi`): search, the category tiles, what is open in the
 * default area, the areas, and the owner call-to-action. Rendered on the
 * server; "open now" depends on the clock, so the page revalidates every minute.
 */

export const revalidate = 60;

type Params = Promise<{ locale: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale, city: cityId } = await params;
	const [ctx, city] = await Promise.all([getSgContext(locale), getCity(cityId)]);
	if (!city) return {};
	const name = localName(ctx, city);
	return {
		title: { absolute: ctx.t('home.metaTitle', { city: name }) },
		description: ctx.t('home.metaDescription', { city: name }),
		alternates: { canonical: ctx.href(`/${city.id}`), languages: { en: `/${city.id}`, th: `/th/${city.id}` } }
	};
}

export default async function CityHomePage({ params }: { params: Params }) {
	const { locale, city: cityId } = await params;
	setRequestLocale(locale);
	const [ctx, city, categories, listings] = await Promise.all([
		getSgContext(locale),
		getCity(cityId),
		getCategories(),
		getCityListings(cityId)
	]);
	if (!city) notFound();

	const defaultArea = city.areas.find((a) => a.id === city.defaultArea) ?? city.areas[0];
	const origin = defaultArea?.geo ?? city.geo;
	const ranked = rankListings(listings, { origin, sort: 'nearest' });
	const inArea = defaultArea ? ranked.filter((r) => r.listing.area === defaultArea.id) : ranked;
	const openInArea = inArea.filter((r) => r.open);
	// Phones show 3; the desktop grid shows up to 6 (the rest are hidden below 960px in CSS).
	const featured = (openInArea.length ? openInArea : inArea).slice(0, 6);
	const areaCounts = new Map<string, number>();
	for (const l of listings) areaCounts.set(l.area, (areaCounts.get(l.area) ?? 0) + 1);

	const now = cityNow();
	const nowLabel = `${ctx.t(`days.${now.day}`)} ${formatMinutes(now.minutes)}`;
	const place = defaultArea ? localName(ctx, defaultArea) : localName(ctx, city);
	const cityName = localName(ctx, city);

	return (
		<div className="sg-page sg-home">
			<BrandBar ctx={ctx} city={city} langPath={`/${city.id}`} active="home" />
			<div className="sg-band sg-hero">
				<div className="tkg-small tkg-muted" style={{ marginBottom: 2 }}>
					<Icon name="pin" className="tkg-i-16" /> {place} · {nowLabel}
				</div>
				<h1 className="tkg-display" style={{ margin: '0 0 12px', color: 'var(--sea-deep)' }}>
					{ctx.t('home.headline', { city: cityName })}
				</h1>
				<SearchBar ctx={ctx} city={city} />
				<div className="tkg-search-hints">
					<Chip href={ctx.href(`/${city.id}/search?open=1`)} icon="clock">
						{ctx.t('results.openNow')}
					</Chip>
					{defaultArea ? <Chip href={ctx.href(`/${city.id}/${defaultArea.id}`)}>{place}</Chip> : null}
				</div>
			</div>

			{listings.some((l) => l.sample) ? <SampleNotice ctx={ctx} /> : null}

			<section className="tkg-section" style={{ paddingTop: 20 }}>
				<SectionHeading
					title={ctx.t('home.categories')}
					link={{
						href: ctx.href(`/${city.id}/search`),
						label: ctx.t('home.allCategories', { count: categories.length })
					}}
				/>
				<CategoryGrid ctx={ctx} city={city.id} categories={categories.slice(0, 8)} />
			</section>

			<section className="tkg-section">
				<SectionHeading
					title={ctx.t('home.openIn', { place })}
					sub={ctx.t('home.openCount', { count: openInArea.length })}
					link={{
						href: ctx.href(
							defaultArea ? `/${city.id}/${defaultArea.id}?open=1` : `/${city.id}/search?open=1`
						),
						label: ctx.t('home.seeAll')
					}}
				/>
				<div className="tkg-list">
					{featured.map((item) => (
						<ListingCard key={item.listing.slug} ctx={ctx} city={city} item={item} />
					))}
				</div>
			</section>

			{city.areas.length ? (
				<section className="tkg-section">
					<SectionHeading title={ctx.t('home.areas')} sub={ctx.t('home.areasSub', { city: cityName })} />
					<div className="tkg-chiprow">
						{city.areas.map((a) => (
							<Chip
								key={a.id}
								href={ctx.href(`/${city.id}/${a.id}`)}
								on={a.id === defaultArea?.id}
								small={[otherName(ctx, a), String(areaCounts.get(a.id) ?? 0)]
									.filter(Boolean)
									.join(' · ')}
							>
								{localName(ctx, a)}
							</Chip>
						))}
					</div>
				</section>
			) : null}

			<section className="tkg-section sg-grow" style={{ paddingBottom: 24 }}>
				<div className="tkg-ownercta">
					<div>
						<h3>{ctx.t('home.ownerTitle', { city: cityName })}</h3>
						<p>{ctx.t('home.ownerBody')}</p>
					</div>
					<Link className="tkg-btn tkg-btn-sun tkg-btn-sm" href={ctx.href('/auth/register')}>
						{ctx.t('home.claim')}
					</Link>
				</div>
			</section>

			<BottomNav ctx={ctx} city={city.id} active="home" />
		</div>
	);
}
