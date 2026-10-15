import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/soiguru/icon';
import { TileMap } from '@/components/soiguru/tile-map';
import { BackBar, CompactList, Rating, SampleNotice } from '@/components/soiguru/parts';
import { amenityLabel, getAmenities, getCity, getCityListings, getListing } from '@/lib/soiguru/content';
import {
	categoryName,
	getSgContext,
	listingOtherName,
	listingPath,
	listingTitle,
	localName,
	relativeTime,
	statusClass,
	statusText,
	type SgContext
} from '@/lib/soiguru/context';
import {
	directionsHref,
	distanceMetres,
	formatPriceBand,
	formatThaiPhone,
	lineHref,
	telHref,
	whatsappHref
} from '@/lib/soiguru/format';
import { formatRanges, hoursTableRows } from '@/lib/soiguru/hours';
import { listingStatus, rankListings } from '@/lib/soiguru/query';
import { WEEKDAYS, type City, type Listing } from '@/lib/soiguru/types';
import { getBaseUrl } from '@/lib/utils/url-cleaner';
import { saveListing } from '../../../actions';

/**
 * ListingPage (`/krabi/ao-nang/krabi-nail`): one business, in the order of a
 * visitor's questions. Server-rendered with LocalBusiness JSON-LD
 * (openingHoursSpecification, geo, aggregateRating) for search.
 */

export const revalidate = 60;

type Params = Promise<{ locale: string; city: string; segment: string; slug: string }>;

async function load(cityId: string, areaId: string, slug: string) {
	const [city, listing] = await Promise.all([getCity(cityId), getListing(cityId, areaId, slug)]);
	return city && listing ? { city, listing } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale, city: cityId, segment, slug } = await params;
	const [ctx, found] = await Promise.all([getSgContext(locale), load(cityId, segment, slug)]);
	if (!found) return {};
	const { city, listing } = found;
	const path = listingPath(listing);
	const name = listingTitle(ctx, listing);
	const area = city.areas.find((a) => a.id === listing.area);
	return {
		title: {
			absolute: `${name} · ${categoryName(ctx, listing.category)} · ${area ? localName(ctx, area) : ''} | SoiGuru`
		},
		description: ctx.t('listing.metaDescription', {
			name,
			category: categoryName(ctx, listing.category),
			area: area ? localName(ctx, area) : listing.area,
			city: localName(ctx, city)
		}),
		alternates: { canonical: ctx.href(path), languages: { en: path, th: `/th${path}` } },
		openGraph: { title: name, type: 'website', url: ctx.href(path) },
		// Sample listings are placeholders and must never be indexed.
		robots: listing.sample ? { index: false, follow: true } : undefined
	};
}

const SCHEMA_DAYS: Record<string, string> = {
	mon: 'Monday',
	tue: 'Tuesday',
	wed: 'Wednesday',
	thu: 'Thursday',
	fri: 'Friday',
	sat: 'Saturday',
	sun: 'Sunday'
};

/** schema.org LocalBusiness (or the category's subtype) for the listing. */
function localBusinessJsonLd(listing: Listing, city: City, url: string) {
	const area = city.areas.find((a) => a.id === listing.area);
	const openingHoursSpecification = WEEKDAYS.flatMap((d) =>
		(listing.hours[d] ?? []).map((r) => ({
			'@type': 'OpeningHoursSpecification',
			dayOfWeek: `https://schema.org/${SCHEMA_DAYS[d]}`,
			opens: `${String(Math.floor(r.start / 60)).padStart(2, '0')}:${String(r.start % 60).padStart(2, '0')}`,
			closes:
				r.end === 1440
					? '23:59'
					: `${String(Math.floor(r.end / 60)).padStart(2, '0')}:${String(r.end % 60).padStart(2, '0')}`
		}))
	);
	return {
		'@context': 'https://schema.org',
		'@type': listing.category.schemaType || 'LocalBusiness',
		'@id': `${url}#business`,
		name: listing.name,
		...(listing.nameTh ? { alternateName: listing.nameTh } : {}),
		...(listing.description ? { description: listing.description } : {}),
		url,
		...(listing.phone ? { telephone: listing.phone } : {}),
		...(listing.images.length ? { image: listing.images } : {}),
		...(formatPriceBand(listing.priceBand) ? { priceRange: formatPriceBand(listing.priceBand) } : {}),
		address: {
			'@type': 'PostalAddress',
			...(listing.address ? { streetAddress: listing.address } : {}),
			addressLocality: area?.name ?? listing.area,
			addressRegion: city.name,
			addressCountry: 'TH'
		},
		...(listing.geo
			? { geo: { '@type': 'GeoCoordinates', latitude: listing.geo.lat, longitude: listing.geo.lng } }
			: {}),
		...(openingHoursSpecification.length ? { openingHoursSpecification } : {}),
		...(listing.rating !== undefined && listing.ratingCount
			? {
					aggregateRating: {
						'@type': 'AggregateRating',
						ratingValue: listing.rating,
						reviewCount: listing.ratingCount,
						bestRating: 5
					}
				}
			: {})
	};
}

function provenance(ctx: SgContext, l: Listing): string | undefined {
	if (!l.updatedAt) return undefined;
	const when = relativeTime(ctx, l.updatedAt);
	if (l.updatedBy === 'owner') return ctx.t('listing.updatedOwner', { when });
	if (l.updatedBy === 'editor') return ctx.t('listing.updatedEditor', { when });
	return ctx.t('listing.updatedImport', { when });
}

export default async function ListingPage({ params }: { params: Params }) {
	const { locale, city: cityId, segment, slug } = await params;
	setRequestLocale(locale);
	const [ctx, found, amenities] = await Promise.all([
		getSgContext(locale),
		load(cityId, segment, slug),
		getAmenities()
	]);
	if (!found) notFound();
	const { city, listing: l } = found;

	const area = city.areas.find((a) => a.id === l.area);
	const areaLabel = area ? localName(ctx, area) : l.area;
	const status = listingStatus(l);
	const title = listingTitle(ctx, l);
	const other = listingOtherName(ctx, l);
	const price = formatPriceBand(l.priceBand);
	const path = listingPath(l);
	const url = `${getBaseUrl()}${ctx.href(path)}`;

	const contacts = [
		l.phone && { key: 'call', href: telHref(l.phone), icon: 'phone', label: ctx.t('listing.call'), cls: undefined },
		l.lineId && {
			key: 'line',
			href: lineHref(l.lineId),
			icon: 'chat',
			label: ctx.t('listing.line'),
			cls: 'tkg-c-line'
		},
		l.whatsapp && {
			key: 'wa',
			href: whatsappHref(l.whatsapp),
			icon: 'chat',
			label: ctx.t('listing.whatsapp'),
			cls: 'tkg-c-wa'
		},
		l.geo && {
			key: 'dir',
			href: directionsHref(l.geo),
			icon: 'navigation',
			label: ctx.t('listing.directions'),
			cls: 'tkg-c-primary'
		}
	].filter((c): c is { key: string; href: string; icon: string; label: string; cls: string | undefined } => !!c);
	const rawContact = [formatThaiPhone(l.phone), l.lineId ? `LINE ${l.lineId}` : undefined, l.bookingNote].filter(
		Boolean
	);

	// Nearby · open now: the closest open places, 2 at most, within 1 km.
	const nearby = l.geo
		? rankListings(
				(await getCityListings(city.id)).filter(
					(x) => x.slug !== l.slug && x.geo && distanceMetres(l.geo!, x.geo) <= 1000
				),
				{ origin: l.geo }
			)
				.filter((r) => r.open)
				.slice(0, 2)
		: [];

	const jsonLd = localBusinessJsonLd(l, city, url);

	return (
		<div className="sg-page">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
			/>
			<BackBar
				ctx={ctx}
				city={city.id}
				backHref={ctx.href(`/${city.id}/${l.category.id}?area=${l.area}`)}
				title={title}
				subtitle={`${categoryName(ctx, l.category)} · ${areaLabel}`}
			>
				<form action={saveListing}>
					<input type="hidden" name="locale" value={locale} />
					<input type="hidden" name="city" value={city.id} />
					<input type="hidden" name="listing" value={l.slug} />
					<button
						className="tkg-iconbtn"
						type="submit"
						aria-label={ctx.t('saved.save')}
						title={ctx.t('saved.save')}
					>
						<Icon name="heart" />
					</button>
				</form>
			</BackBar>

			{l.images.length ? (
				<div className="tkg-strip" style={{ position: 'relative' }}>
					{/* Plain <img>: owner photos come from arbitrary hosts. */}
					<img
						className="tkg-photo"
						src={l.images[0]}
						alt=""
						style={{ flex: 2, objectFit: 'cover', minWidth: 0 }}
					/>
					{l.images.length > 2 ? (
						<div className="tkg-strip-side">
							{l.images.slice(1, 3).map((src) => (
								// Plain <img>: owner photos come from arbitrary hosts.
								<img
									key={src}
									className="tkg-photo"
									src={src}
									alt=""
									loading="lazy"
									style={{ objectFit: 'cover', width: '100%' }}
								/>
							))}
						</div>
					) : null}
					<span className="tkg-strip-count">
						<Icon name="camera" />
						{ctx.t('listing.photos', { count: l.images.length })}
					</span>
				</div>
			) : null}

			{/* Phone: one column in the design's order (the wrappers are display: contents and each block
			    carries its order). From 1024px: details on the left, contact, hours and map in a sticky right rail. */}
			<div className="sg-listing-grid">
				<div className="sg-listing-main">
					<div style={{ order: 1 }}>
						<div className="sg-title-block">
							<div className="tkg-hstack" style={{ gap: 8, alignItems: 'center' }}>
								<h1 className="tkg-title" style={{ margin: 0 }}>
									{title}
								</h1>
								{l.claimed ? (
									<span className="tkg-badge">
										<Icon name="shield" />
										{ctx.t('listing.verified')}
									</span>
								) : null}
							</div>
							<div className="tkg-body tkg-muted" style={{ marginTop: 2 }}>
								{[other, categoryName(ctx, l.category)].filter(Boolean).join(' · ')}
							</div>
							<div className="tkg-hstack" style={{ marginTop: 8, gap: 12 }}>
								<span className={`${statusClass(status)} tkg-status-lg`}>
									{statusText(ctx, status)}
								</span>
								<Rating value={l.rating} count={l.ratingCount} />
								{price ? <span className="tkg-small tkg-muted">{price}</span> : null}
							</div>
							{l.address ? (
								<div className="tkg-small tkg-muted" style={{ marginTop: 8 }}>
									<Icon name="pin" className="tkg-i-16" /> {l.address}
								</div>
							) : null}
							{provenance(ctx, l) ? (
								<div className="tkg-small tkg-muted" style={{ marginTop: 2 }}>
									{provenance(ctx, l)}
								</div>
							) : null}
						</div>
					</div>
					<div style={{ order: 2 }}>{l.sample ? <SampleNotice ctx={ctx} /> : null}</div>
					<div style={{ order: 5 }}>
						{l.amenities.length ? (
							<section className="tkg-section">
								<div className="tkg-section-h">
									<h2>
										{ctx.t('listing.goodToKnow')}
										<small>{ctx.t('listing.goodToKnowSub')}</small>
									</h2>
								</div>
								<div className="tkg-amenities">
									{l.amenities.map((a) => (
										<div key={a.id} className={a.available ? undefined : 'tkg-no'}>
											<Icon name={a.available ? 'check' : 'close'} />
											{a.available
												? amenityLabel(amenities, a.id, ctx.thai)
												: `${ctx.thai ? 'ไม่มี' : 'No'} ${amenityLabel(amenities, a.id, ctx.thai).toLowerCase()}`}
										</div>
									))}
								</div>
							</section>
						) : null}
					</div>
					<div style={{ order: 6 }}>
						{l.description || l.descriptionTh ? (
							<section className="tkg-section">
								<div className="tkg-section-h">
									<h2>{ctx.t('listing.about')}</h2>
								</div>
								{(ctx.thai ? [l.descriptionTh, l.description] : [l.description, l.descriptionTh])
									.filter(Boolean)
									.map((text, i) => (
										<p
											key={i}
											lang={(i === 0) === ctx.thai ? 'th' : 'en'}
											className={`tkg-body tkg-pad${i > 0 ? ' tkg-muted' : ''}${(i === 0) === ctx.thai ? ' tkg-th' : ''}`}
											style={{ margin: i > 0 ? '8px 0 0' : 0 }}
										>
											{text}
										</p>
									))}
							</section>
						) : null}
					</div>
					<div style={{ order: 9 }}>
						{nearby.length ? (
							<section className="tkg-section">
								<div className="tkg-section-h">
									<h2>{ctx.t('listing.nearby')}</h2>
									<Link href={ctx.href(`/${city.id}/${l.area}?open=1`)}>{ctx.t('listing.more')}</Link>
								</div>
								<CompactList ctx={ctx} city={city} items={nearby} />
							</section>
						) : null}
					</div>
					<div style={{ order: 10 }}>
						<div className="tkg-pad sg-grow" style={{ paddingTop: 20, paddingBottom: 24 }}>
							<a
								className="tkg-btn tkg-btn-ghost"
								style={{ paddingLeft: 0 }}
								href={
									process.env.SOIGURU_REPORT_EMAIL
										? `mailto:${process.env.SOIGURU_REPORT_EMAIL}?subject=${encodeURIComponent(`Wrong info: ${l.name} (${city.id}/${l.slug})`)}`
										: ctx.href('/help')
								}
							>
								<Icon name="flag" />
								{ctx.t('listing.report')}
							</a>
							<div className="tkg-small tkg-muted">
								{ctx.t('listing.listingId', { id: `${city.id}/${l.slug}` })}
								{l.sample ? ` · ${ctx.t('listing.sample')}` : ''}
							</div>
						</div>
					</div>
				</div>
				<aside className="sg-listing-aside">
					<div style={{ order: 3 }}>
						{contacts.length ? (
							<div className="sg-contact-block" style={l.sample ? { marginTop: 12 } : undefined}>
								<div
									className={`tkg-contact${contacts.length < 4 ? ` sg-cols-${contacts.length}` : ''}`}
								>
									{contacts.map((c) => (
										<a
											key={c.key}
											href={c.href}
											className={c.cls}
											{...(c.key === 'call' ? {} : { target: '_blank', rel: 'noopener' })}
										>
											<Icon name={c.icon} />
											{c.label}
										</a>
									))}
								</div>
								{rawContact.length ? (
									<div className="tkg-small tkg-muted tkg-pad sg-copy" style={{ marginTop: 8 }}>
										{rawContact.join(' · ')}
									</div>
								) : null}
							</div>
						) : null}
					</div>
					<div style={{ order: 4 }}>
						<section className="tkg-section">
							<div className="tkg-section-h">
								<h2>{ctx.t('listing.hours')}</h2>
							</div>
							<div className="tkg-pad">
								{l.hoursNote ? (
									<p className="tkg-small" style={{ margin: '0 0 8px' }}>
										{l.hoursNote}
									</p>
								) : null}
								{l.hasHours ? (
									<div className="sg-hours-card">
										<table className="tkg-hours">
											<tbody>
												{hoursTableRows(l.hours).map((row) => {
													const days =
														row.days.length > 1
															? `${ctx.t(`days.${row.days[0]}`)}–${ctx.t(`days.${row.days[row.days.length - 1]}`)}`
															: ctx.t(`days.${row.days[0]}`);
													return (
														<tr
															key={row.days.join('-')}
															className={row.today ? 'tkg-today' : undefined}
														>
															<td>
																{row.today
																	? `${days} · ${ctx.t('listing.today')}`
																	: days}
															</td>
															{row.ranges === null ? (
																<td className="tkg-muted">–</td>
															) : row.ranges.length === 0 ? (
																<td className="tkg-closed-day">
																	{ctx.t('listing.closed')}
																</td>
															) : (
																<td>
																	{formatRanges(row.ranges).map((r) => (
																		<span key={r}>
																			{r === '24h' ? ctx.t('status.open24') : r}
																		</span>
																	))}
																</td>
															)}
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								) : (
									<p className="tkg-body tkg-muted" style={{ margin: 0 }}>
										{ctx.t('listing.hoursUnknown')}
									</p>
								)}
							</div>
						</section>
					</div>
					<div style={{ order: 7 }}>
						{l.geo ? (
							<section className="tkg-section">
								<div className="tkg-section-h">
									<h2>
										{ctx.t('listing.where')}
										{l.address ? <small>{l.address}</small> : null}
									</h2>
									<a href={directionsHref(l.geo)} target="_blank" rel="noopener">
										{ctx.t('listing.directions')}
									</a>
								</div>
								<div className="tkg-pad">
									<a
										href={directionsHref(l.geo)}
										target="_blank"
										rel="noopener"
										aria-label={ctx.t('listing.directions')}
									>
										<TileMap
											pins={[{ id: l.slug, geo: l.geo, label: title, selected: true }]}
											height={160}
											className="sg-where-map"
										/>
									</a>
									<p className="tkg-small tkg-muted" style={{ margin: '6px 0 0' }}>
										{ctx.t('results.attribution')}
									</p>
								</div>
							</section>
						) : null}
					</div>
					<div style={{ order: 8 }}>
						{!l.claimed ? (
							<section className="tkg-section">
								<div className="tkg-claim">
									<h3>{ctx.t('listing.claimTitle')}</h3>
									<p>
										{ctx.t('listing.claimBody')}{' '}
										<span className="tkg-claim-price">{ctx.t('listing.claimPrice')}</span>{' '}
										{ctx.t('listing.claimYear')}
									</p>
									<Link
										className="tkg-btn tkg-btn-sun"
										href={ctx.href(`/${city.id}/claim?listing=${l.slug}&step=2`)}
									>
										<Icon name="shield" />
										{ctx.t('listing.claimButton')}
									</Link>
								</div>
								<p className="tkg-info" style={{ marginTop: 8 }}>
									<Icon name="info" />
									<span>{ctx.t('listing.staleNote')}</span>
								</p>
							</section>
						) : null}
					</div>
				</aside>
			</div>

			<div className="tkg-bottombar">
				<div className="tkg-bb-info">
					<span className={statusClass(status)}>{statusText(ctx, status)}</span>
					<small>{areaLabel}</small>
				</div>
				{l.geo ? (
					<a className="tkg-btn" href={directionsHref(l.geo)} target="_blank" rel="noopener">
						<Icon name="navigation" />
						{ctx.t('listing.directions')}
					</a>
				) : null}
			</div>
		</div>
	);
}
