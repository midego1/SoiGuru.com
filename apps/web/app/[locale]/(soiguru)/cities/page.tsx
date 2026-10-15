import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/soiguru/icon';
import { BrandBar } from '@/components/soiguru/parts';
import { getCities, getListings } from '@/lib/soiguru/content';
import { getSgContext, localName, otherName } from '@/lib/soiguru/context';

/**
 * soiguru.com landing: the list of cities. Served at `/` (next.config rewrite)
 * and at `/cities`.
 */

export const revalidate = 300;

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return {
		title: { absolute: ctx.t('landing.metaTitle') },
		description: ctx.t('landing.metaDescription'),
		alternates: { canonical: ctx.href('/'), languages: { en: '/', th: '/th' } }
	};
}

export default async function CitiesLandingPage({ params }: { params: Params }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const [ctx, cities, listings] = await Promise.all([getSgContext(locale), getCities(), getListings()]);
	const counts = new Map<string, number>();
	for (const l of listings) counts.set(l.city, (counts.get(l.city) ?? 0) + 1);

	return (
		<div className="sg-page">
			<BrandBar ctx={ctx} langPath="/" />
			<div className="sg-landing-head">
				<h1 className="tkg-display" style={{ margin: '0 0 8px', color: 'var(--sea-deep)' }}>
					{ctx.t('landing.headline')}
				</h1>
				<p className="tkg-body tkg-muted" style={{ margin: 0 }}>
					{ctx.t('landing.intro')}
				</p>
			</div>
			<section className="tkg-section sg-grow">
				<div className="tkg-section-h">
					<h2>{ctx.t('landing.chooseCity')}</h2>
				</div>
				<div className="tkg-rows">
					{cities.map((c) => (
						<Link key={c.id} className="tkg-row sg-city-row" href={ctx.href(`/${c.id}`)}>
							<Icon name="pin" className="tkg-i-24" />
							<span className="tkg-row-main">
								<b>{localName(ctx, c)}</b>
								{otherName(ctx, c) ? <span className="sg-city-th">{otherName(ctx, c)}</span> : null}
								<small>{ctx.t('landing.places', { count: counts.get(c.id) ?? 0 })}</small>
							</span>
							<Icon name="chevron-right" className="tkg-i-chev" />
						</Link>
					))}
				</div>
			</section>
		</div>
	);
}
