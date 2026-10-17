import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { Icon } from '@/components/soiguru/icon';
import { BottomNav, BrandBar, ListingCard } from '@/components/soiguru/parts';
import { SignInPrompt } from '@/components/soiguru/owner';
import { unsaveListing } from '../actions';
import { getCities, getCityListings } from '@/lib/soiguru/content';
import { getSgContext, listingTitle, localName } from '@/lib/soiguru/context';
import { listingStatus } from '@/lib/soiguru/query';
import { getSavedSlugs } from '@/lib/soiguru/saved';
import type { City, Listing } from '@/lib/soiguru/types';

/**
 * Saved (`/saved?city=`): the places the visitor saved with the heart on a
 * listing, grouped by city, the city in the query string first. Needs an
 * account; the list lives in the template's `favorites` table.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: `${ctx.t('saved.title')} · SoiGuru` }, robots: { index: false } };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SavedPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const cities = await getCities();
	const city: City = cities.find((c) => c.id === one(sp.city)) ?? cities[0];
	const path = `/saved?city=${city.id}`;
	const session = await auth();
	const userId = session?.user?.id;

	let groups: { city: City; listings: Listing[] }[] = [];
	let added: Listing | undefined;
	if (userId) {
		const slugs = await getSavedSlugs(userId);
		const order = new Map(slugs.map((s, i) => [s, i]));
		const ordered = [city, ...cities.filter((c) => c.id !== city.id)];
		groups = (
			await Promise.all(
				ordered.map(async (c) => ({
					city: c,
					listings: (await getCityListings(c.id))
						.filter((l) => order.has(l.slug))
						.sort((a, b) => order.get(a.slug)! - order.get(b.slug)!)
				}))
			)
		).filter((g) => g.listings.length);
		added = groups.flatMap((g) => g.listings).find((l) => l.slug === one(sp.added));
	}

	return (
		<div className="sg-page sg-saved">
			<BrandBar ctx={ctx} city={city} langPath={path} active="saved" />
			{added ? (
				<p className="tkg-info sg-sample" role="status">
					<Icon name="check" />
					<span>{ctx.t('saved.added', { name: listingTitle(ctx, added) })}</span>
				</p>
			) : null}
			{!userId ? (
				<SignInPrompt
					ctx={ctx}
					back={ctx.href(path)}
					title={ctx.t('saved.signInTitle')}
					body={ctx.t('saved.signInBody')}
				/>
			) : groups.length ? (
				<div className="sg-grow" style={{ paddingBottom: 24 }}>
					{groups.map((g) => (
						<section key={g.city.id} className="tkg-section">
							<div className="tkg-section-h">
								<h2>
									{localName(ctx, g.city)}
									<small>{ctx.t('saved.count', { count: g.listings.length })}</small>
								</h2>
							</div>
							<div className="tkg-list sg-saved-list">
								{g.listings.map((l) => (
									<div key={l.slug} className="sg-saved-item">
										<ListingCard
											ctx={ctx}
											city={g.city}
											item={{ listing: l, status: listingStatus(l), open: false }}
										/>
										<form action={unsaveListing}>
											<input type="hidden" name="locale" value={locale} />
											<input type="hidden" name="city" value={city.id} />
											<input type="hidden" name="listing" value={l.slug} />
											<button className="tkg-btn tkg-btn-ghost tkg-btn-sm" type="submit">
												{ctx.t('saved.remove')}
											</button>
										</form>
									</div>
								))}
							</div>
						</section>
					))}
				</div>
			) : (
				<section className="tkg-section sg-grow" style={{ paddingTop: 20 }}>
					<div className="tkg-pad">
						<h1 className="tkg-title" style={{ margin: '0 0 4px' }}>
							{ctx.t('saved.emptyTitle')}
						</h1>
						<p className="tkg-body tkg-muted" style={{ margin: '0 0 16px' }}>
							{ctx.t('saved.emptyBody')}
						</p>
						<Link className="tkg-btn" href={ctx.href(`/${city.id}`)}>
							{ctx.t('saved.browse', { city: localName(ctx, city) })}
						</Link>
					</div>
				</section>
			)}
			<BottomNav ctx={ctx} city={city.id} active="saved" />
		</div>
	);
}
