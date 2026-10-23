import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC_SITE } from '@/lib/soiguru/public-site';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { Icon } from '@/components/soiguru/icon';
import { BottomNav, Thumb } from '@/components/soiguru/parts';
import { OwnerBar, SignInPrompt } from '@/components/soiguru/owner';
import { getReviewQueue, getUserClaims, PLAN_PRICE_THB, userIsAdmin } from '@/lib/soiguru/claims';
import { getCities, getCityListings } from '@/lib/soiguru/content';
import {
	areaName,
	formatDay,
	getSgContext,
	listingPath,
	listingTitle,
	statusClass,
	statusText,
	type SgContext
} from '@/lib/soiguru/context';
import { formatRanges } from '@/lib/soiguru/hours';
import { menuItemCount } from '@/lib/soiguru/menu';
import { listingStatus } from '@/lib/soiguru/query';
import { WEEKDAYS, type City, type Listing, type TimeRange, type Weekday } from '@/lib/soiguru/types';
import type { ListingClaim } from '@/lib/db/schema';

/**
 * OwnerDashboard overview (`/owner`): the listing as visitors see it, one
 * nudge generated from the data, and rows into Details, Hours, Good to know
 * and Billing. Pending claims show what happens next.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: ctx.t('owner.metaTitle') }, robots: { index: false, follow: false } };
}

function hoursSummary(ctx: SgContext, l: Listing): string {
	if (!l.hasHours) return ctx.t('owner.hoursEmpty');
	// Mon to Sun with equal neighbours merged (the listing's table starts at today instead).
	const key = (d: Weekday) => JSON.stringify(l.hours[d]);
	const rows: { days: Weekday[]; ranges: TimeRange[] | null }[] = [];
	for (const d of WEEKDAYS) {
		const last = rows[rows.length - 1];
		if (last && key(last.days[0]) === key(d)) last.days.push(d);
		else rows.push({ days: [d], ranges: l.hours[d] });
	}
	return rows
		.map((r) => {
			const days =
				r.days.length > 1
					? `${ctx.t(`days.${r.days[0]}`)}–${ctx.t(`days.${r.days[r.days.length - 1]}`)}`
					: ctx.t(`days.${r.days[0]}`);
			if (r.ranges === null) return `${days} –`;
			if (!r.ranges.length) return `${days} ${ctx.t('listing.closed').toLowerCase()}`;
			return `${days} ${formatRanges(r.ranges).join(', ')}`;
		})
		.join(' · ');
}

/** One nudge at a time, most useful first (design: OwnerDashboard). */
function nudge(ctx: SgContext, l: Listing, base: string): { text: string; href: string; link: string } | null {
	const emptyDay = WEEKDAYS.find((d) => l.hours[d] === null);
	if (!l.hasHours) return { text: ctx.t('owner.nudgeNoHours'), href: `${base}/hours`, link: ctx.t('owner.setHours') };
	if (emptyDay)
		return {
			text: ctx.t('owner.nudgeDay', { day: ctx.t(`days.${emptyDay}`) }),
			href: `${base}/hours`,
			link: ctx.t('owner.setHours')
		};
	if (!l.nameTh) return { text: ctx.t('owner.nudgeThai'), href: `${base}/details`, link: ctx.t('owner.addIt') };
	if (!l.lineId) return { text: ctx.t('owner.nudgeLine'), href: `${base}/details`, link: ctx.t('owner.addIt') };
	if (!l.amenities.length)
		return { text: ctx.t('owner.nudgeAmenities'), href: `${base}/amenities`, link: ctx.t('owner.addIt') };
	if (!l.images.length)
		return { text: ctx.t('owner.nudgePhotos'), href: `${base}/photos`, link: ctx.t('owner.addIt') };
	if (!l.menu.length) return { text: ctx.t('owner.nudgeMenu'), href: `${base}/menu`, link: ctx.t('owner.addIt') };
	return null;
}

export default async function OwnerPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const session = await auth();
	const cities = await getCities();
	const firstCity = cities[0]?.id ?? 'krabi';

	if (!session?.user?.id) {
		return (
			<div className="sg-page sg-owner">
				<OwnerBar ctx={ctx} langPath="/owner" />
				<SignInPrompt ctx={ctx} back={ctx.href('/owner')} />
				<BottomNav ctx={ctx} city={firstCity} active="owner" />
			</div>
		);
	}

	const [claims, admin] = await Promise.all([getUserClaims(session.user.id), userIsAdmin(session.user.id)]);
	const queue = admin ? await getReviewQueue() : [];
	const listingsByCity = new Map<string, Listing[]>();
	for (const c of new Set(claims.map((x) => x.city))) listingsByCity.set(c, await getCityListings(c));
	const listingOf = (c: ListingClaim) => listingsByCity.get(c.city)?.find((l) => l.slug === c.listingSlug);
	const cityOf = (id: string) => cities.find((c) => c.id === id);

	const approved = claims.filter((c) => c.status === 'approved' && listingOf(c));
	const pending = claims.filter((c) => c.status === 'pending');
	const rejected = claims.filter((c) => c.status === 'rejected');
	const wanted = one(sp.listing);
	const current = approved.find((c) => `${c.city}/${c.listingSlug}` === wanted) ?? approved[0];
	const justClaimed = one(sp.claimed);
	const homeCity = current?.city ?? claims[0]?.city ?? firstCity;

	return (
		<div className="sg-page sg-owner">
			<OwnerBar ctx={ctx} langPath="/owner" />

			{justClaimed ? (
				<p className="tkg-info sg-sample" role="status">
					<Icon name="check" />
					<span>{ctx.t('owner.received')}</span>
				</p>
			) : null}

			{admin ? (
				<p className="tkg-info sg-sample">
					<Icon name="shield" />
					<span>
						{ctx.t('owner.adminQueue', { count: queue.length })}{' '}
						<Link href={ctx.href('/owner/review')}>{ctx.t('owner.reviewLink')}</Link>
					</span>
				</p>
			) : null}

			{current ? (
				<ListingOverview ctx={ctx} claim={current} listing={listingOf(current)!} city={cityOf(current.city)} />
			) : null}

			{pending.length ? (
				<section className="tkg-section">
					<div className="tkg-section-h">
						<h2>{ctx.t('owner.pendingTitle')}</h2>
					</div>
					<div className="tkg-stack tkg-pad">
						{pending.map((c) => {
							const l = listingOf(c);
							return (
								<div key={c.id} className="sg-owner-card">
									<div className="tkg-hstack" style={{ justifyContent: 'space-between' }}>
										<span className="tkg-strong">{l ? listingTitle(ctx, l) : c.listingSlug}</span>
										<span className="tkg-badge tkg-badge-outline">{ctx.t('owner.pending')}</span>
									</div>
									<div className="tkg-small tkg-muted" style={{ marginTop: 4 }}>
										{c.verification === 'sign'
											? ctx.t('owner.pendingSign')
											: ctx.t('owner.pendingCall', {
													phone: c.contactPhone || l?.phone || ''
												})}{' '}
										{ctx.t('owner.pendingPay', {
											plan: ctx
												.t(`claim.${c.plan === 'monthly' ? 'monthly' : 'yearly'}`)
												.toLowerCase(),
											amount: `฿${PLAN_PRICE_THB[c.plan === 'monthly' ? 'monthly' : 'yearly'].toLocaleString('en-US')}`
										})}
									</div>
								</div>
							);
						})}
					</div>
				</section>
			) : null}

			{approved.length > 1 ? (
				<section className="tkg-section">
					<div className="tkg-section-h">
						<h2>{ctx.t('owner.otherListings')}</h2>
					</div>
					<div className="tkg-rows">
						{approved
							.filter((c) => c !== current)
							.map((c) => {
								const l = listingOf(c)!;
								return (
									<Link
										key={c.id}
										className="tkg-row"
										href={ctx.href(`/owner?listing=${c.city}/${c.listingSlug}`)}
									>
										<Icon name="pin" />
										<span className="tkg-row-main">
											{listingTitle(ctx, l)}
											<small>
												{cityOf(c.city) ? areaName(ctx, cityOf(c.city)!, l.area) : c.city}
											</small>
										</span>
										<Icon name="chevron-right" className="tkg-i-chev" />
									</Link>
								);
							})}
					</div>
				</section>
			) : null}

			{rejected.length && !approved.length && !pending.length ? (
				<p className="tkg-info sg-sample">
					<Icon name="info" />
					<span>{ctx.t('owner.rejected')}</span>
				</p>
			) : null}

			{!claims.length ? (
				<section className="tkg-section">
					<div className="tkg-pad">
						<h1 className="tkg-title" style={{ margin: '0 0 4px' }}>
							{ctx.t('owner.emptyTitle')}
						</h1>
						<p className="tkg-body tkg-muted" style={{ margin: '0 0 16px' }}>
							{ctx.t('owner.emptyBody')}
						</p>
					</div>
				</section>
			) : null}

			<section className="tkg-section sg-grow" style={{ paddingBottom: 24 }}>
				<div className="tkg-pad tkg-stack">
					{cities.map((c) => (
						<Link
							key={c.id}
							className="tkg-btn tkg-btn-ghost"
							style={{ paddingLeft: 0, justifyContent: 'flex-start' }}
							href={ctx.href(`/${c.id}/claim`)}
						>
							<Icon name="plus" />
							{claims.length
								? ctx.t('owner.addAnother', { city: c.name })
								: ctx.t('owner.findYours', { city: c.name })}
						</Link>
					))}
				</div>
			</section>

			<BottomNav ctx={ctx} city={homeCity} active="owner" />
		</div>
	);
}

function ListingOverview({
	ctx,
	claim,
	listing: l,
	city
}: {
	ctx: SgContext;
	claim: ListingClaim;
	listing: Listing;
	city?: City;
}) {
	const base = `/owner/${claim.city}/${claim.listingSlug}`;
	const status = listingStatus(l);
	const tip = nudge(ctx, l, ctx.href(base));
	const set = l.amenities.length;
	const menuItems = menuItemCount(l.menu);
	const plan = ctx.t(`claim.${claim.plan === 'monthly' ? 'monthly' : 'yearly'}`);
	return (
		<>
			<div className="sg-band sg-owner-head">
				<div className="tkg-hstack" style={{ gap: 12, flexWrap: 'nowrap' }}>
					<div className="sg-owner-thumb">
						<Thumb src={l.images[0]} icon={l.category.icon} />
					</div>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div className="tkg-heading">{listingTitle(ctx, l)}</div>
						<div className="tkg-hstack" style={{ gap: 8 }}>
							<span className="tkg-badge">
								<Icon name="shield" />
								{ctx.t('listing.verified')}
							</span>
							<span className={statusClass(status)}>{statusText(ctx, status)}</span>
						</div>
					</div>
					<a className="tkg-btn tkg-btn-secondary tkg-btn-sm" href={`${PUBLIC_SITE}${listingPath(l)}/`}>
						<Icon name="external" />
						{ctx.t('owner.view')}
					</a>
				</div>
				{city ? (
					<div className="tkg-small tkg-muted" style={{ marginTop: 8 }}>
						{areaName(ctx, city, l.area)} · {city.name}
					</div>
				) : null}
			</div>

			{tip ? (
				<section className="tkg-section" style={{ paddingTop: 16 }}>
					<p className="tkg-info">
						<Icon name="alert" />
						<span>
							<b>{tip.text}</b> <Link href={tip.href}>{tip.link}</Link>
						</span>
					</p>
				</section>
			) : null}

			<section className="tkg-section">
				<div className="tkg-section-h">
					<h2>{ctx.t('owner.yourListing')}</h2>
				</div>
				<div className="tkg-rows">
					<Link className="tkg-row" href={ctx.href(`${base}/details`)}>
						<Icon name="edit" />
						<span className="tkg-row-main">
							{ctx.t('owner.details')}
							<small>{ctx.t('owner.detailsSub')}</small>
						</span>
						<Icon name="chevron-right" className="tkg-i-chev" />
					</Link>
					<Link className="tkg-row" href={ctx.href(`${base}/hours`)}>
						<Icon name="clock" />
						<span className="tkg-row-main">
							{ctx.t('owner.hours')}
							<small>{hoursSummary(ctx, l)}</small>
						</span>
						<Icon name="chevron-right" className="tkg-i-chev" />
					</Link>
					<Link className="tkg-row" href={ctx.href(`${base}/amenities`)}>
						<Icon name="check" />
						<span className="tkg-row-main">
							{ctx.t('owner.goodToKnow')}
							<small>
								{set ? ctx.t('owner.goodToKnowSub', { count: set }) : ctx.t('owner.goodToKnowEmpty')}
							</small>
						</span>
						<Icon name="chevron-right" className="tkg-i-chev" />
					</Link>
					<Link className="tkg-row" href={ctx.href(`${base}/menu`)}>
						<Icon name="list" />
						<span className="tkg-row-main">
							{ctx.t('owner.menu')}
							<small>
								{menuItems ? ctx.t('owner.menuSub', { count: menuItems }) : ctx.t('owner.menuEmpty')}
							</small>
						</span>
						<Icon name="chevron-right" className="tkg-i-chev" />
					</Link>
					<Link className="tkg-row" href={ctx.href(`${base}/photos`)}>
						<Icon name="image" />
						<span className="tkg-row-main">
							{ctx.t('owner.photos')}
							<small>
								{l.images.length
									? ctx.t('owner.photosSub', { count: l.images.length })
									: ctx.t('owner.photosNone')}
							</small>
						</span>
						<Icon name="chevron-right" className="tkg-i-chev" />
					</Link>
					<Link className="tkg-row" href={ctx.href(`${base}/billing`)}>
						<Icon name="card" />
						<span className="tkg-row-main">
							{ctx.t('owner.billing')}
							<small>
								{claim.paidUntil
									? ctx.t('owner.billingSub', { plan, date: formatDay(ctx, claim.paidUntil) })
									: plan}
							</small>
						</span>
						<Icon name="chevron-right" className="tkg-i-chev" />
					</Link>
				</div>
			</section>
		</>
	);
}
