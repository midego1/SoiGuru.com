import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { Icon } from '@/components/soiguru/icon';
import { SoiGuruLogo } from '@/components/soiguru/logo-mark';
import { Thumb } from '@/components/soiguru/parts';
import { submitClaim } from '../../actions';
import { ClaimPhotos } from '@/components/soiguru/claim-photos';
import { listClaimPhotos } from '@/lib/soiguru/claim-photos';
import { getClaimedSlugs } from '@/lib/soiguru/claims';
import { getCity, getCityListings } from '@/lib/soiguru/content';
import { areaName, categoryName, getSgContext, listingTitle, type SgContext } from '@/lib/soiguru/context';
import { formatThaiPhone } from '@/lib/soiguru/format';
import { matchesQuery } from '@/lib/soiguru/query';
import type { City, Listing } from '@/lib/soiguru/types';

/**
 * ClaimFlow (`/krabi/claim`): find your business → verify it's you → your photos
 * (spec 064) → choose a plan. Each step is a page state in the query string (`?listing=&step=`),
 * so the flow works without client script; the last step posts one server
 * action that files the claim. Verification (a call to the listing's phone)
 * and payment (PromptPay QR or card link by email) are done by hand for now.
 */

type Params = Promise<{ locale: string; city: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: ctx.t('claim.metaTitle') }, robots: { index: false, follow: false } };
}

export default async function ClaimPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale, city: cityId } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const [ctx, city] = await Promise.all([getSgContext(locale), getCity(cityId)]);
	if (!city) notFound();
	const listings = await getCityListings(city.id);
	const selected = listings.find((l) => l.slug === one(sp.listing));
	const claimedInDb = await getClaimedSlugs(city.id);
	const isClaimed = (l: Listing) => l.claimed || claimedInDb.has(l.slug);
	const requested = Number(one(sp.step) ?? (selected ? 2 : 1));
	const step = !selected || isClaimed(selected) ? 1 : requested === 3 || requested === 4 ? requested : 2;
	const base = `/${city.id}/claim`;

	return (
		<div className="sg-page sg-flow">
			<header className="tkg-topbar sg-claim-bar">
				<Link
					className="tkg-iconbtn"
					href={ctx.href(step === 1 ? '/owner' : `${base}?listing=${selected?.slug}&step=${step - 1}`)}
					aria-label={ctx.t('results.back')}
				>
					<Icon name="chevron-left" />
				</Link>
				<Link className="tkg-brand" href={ctx.href('/owner')} aria-label="SoiGuru">
					<SoiGuruLogo height={30} />
				</Link>
				<span className="sg-brand-owner">{ctx.t('claim.badge')}</span>
				<div className="tkg-spacer" />
				<span className="sg-claim-step">{ctx.t('claim.step', { n: step, name: ctx.t(`claim.step${step}`) })}</span>
				<Link className="tkg-iconbtn" href={ctx.href('/owner')} aria-label={ctx.t('claim.close')}>
					<Icon name="close" />
				</Link>
			</header>
			<div className="tkg-steps" aria-hidden="true">
				{[1, 2, 3, 4].map((n) => (
					<span key={n} className={n <= step ? 'tkg-done' : undefined} />
				))}
			</div>

			{step === 1 ? (
				<FindStep
					ctx={ctx}
					city={city}
					listings={listings}
					isClaimed={isClaimed}
					q={one(sp.q) ?? ''}
					selected={selected}
					taken={one(sp.taken) === '1'}
				/>
			) : (
				<VerifyAndPlan ctx={ctx} city={city} listing={selected!} step={step} sp={sp} />
			)}
		</div>
	);
}

function FindStep({
	ctx,
	city,
	listings,
	isClaimed,
	q,
	selected,
	taken
}: {
	ctx: SgContext;
	city: City;
	listings: Listing[];
	isClaimed: (l: Listing) => boolean;
	q: string;
	selected?: Listing;
	taken: boolean;
}) {
	const query = q.trim().slice(0, 80);
	const digits = query.replace(/\D/g, '');
	const results = query
		? listings
				.filter(
					(l) =>
						matchesQuery(l, query) ||
						(digits.length >= 4 && (l.phone ?? '').replace(/\D/g, '').includes(digits.replace(/^0/, '')))
				)
				.slice(0, 20)
		: [];
	// Nothing searched yet: the page is not empty, it offers the city's unclaimed places to pick
	// from, one per name (a chain's branches would otherwise fill the list), alphabetically.
	const seen = new Set<string>();
	const browse = !query
		? listings
				.filter((l) => !isClaimed(l))
				.sort((a, b) => listingTitle(ctx, a).localeCompare(listingTitle(ctx, b), ctx.locale))
				.filter((l) => {
					const name = listingTitle(ctx, l).toLowerCase();
					if (seen.has(name)) return false;
					seen.add(name);
					return true;
				})
				.slice(0, 12)
		: [];
	const shown = query ? (selected && !results.includes(selected) ? [selected, ...results] : results) : browse;
	const pick = selected && !isClaimed(selected) ? selected : undefined;

	return (
		<>
			<section className="tkg-section sg-grow sg-claim-find">
				<div className="sg-owner-head sg-claim-head">
					<h1 className="tkg-title" style={{ margin: '0 0 4px' }}>
						{ctx.t('claim.findTitle')}
					</h1>
					<p className="tkg-body tkg-muted" style={{ margin: '0 0 12px' }}>
						{ctx.t('claim.findBody', { city: city.name })}
					</p>
					<form className="tkg-search" action={ctx.href(`/${city.id}/claim`)} method="get" role="search">
						<Icon name="search" />
						<input
							type="search"
							name="q"
							defaultValue={query}
							placeholder={ctx.t('claim.findPlaceholder')}
							aria-label={ctx.t('claim.findLabel')}
						/>
						<button className="tkg-search-btn" type="submit">
							{ctx.t('home.search')}
						</button>
					</form>
				</div>
				{taken ? (
					<p className="tkg-info" style={{ marginTop: 12 }}>
						<Icon name="info" />
						<span>{ctx.t('claim.taken')}</span>
					</p>
				) : null}
				{query && !shown.length ? (
					<p className="tkg-body tkg-muted tkg-pad" style={{ marginTop: 12 }}>
						{ctx.t('claim.noResults', { q: query })}
					</p>
				) : null}
				{!query && shown.length ? (
					<div className="tkg-section-h" style={{ marginTop: 12 }}>
						<h2>{ctx.t('claim.browseTitle')}</h2>
					</div>
				) : null}
				{shown.length ? (
					<div className="tkg-rows" style={{ marginTop: query ? 12 : 0 }}>
						{shown.map((l) => {
							const claimed = isClaimed(l);
							const body = (
								<>
									<Thumb src={l.images[0]} icon={l.category.icon} />
									<div className="tkg-card-body">
										<div className="tkg-card-title" style={{ fontSize: 15, lineHeight: '22px' }}>
											<span className="tkg-name">{listingTitle(ctx, l)}</span>
										</div>
										<div className="tkg-card-sub">
											{[
												l.address ?? areaName(ctx, city, l.area),
												categoryName(ctx, l.category)
											].join(' · ')}
										</div>
										<div className="tkg-hstack" style={{ gap: 6, marginTop: 2 }}>
											{claimed ? (
												<span className="tkg-badge">
													<Icon name="shield" />
													{ctx.t('claim.claimed')}
												</span>
											) : (
												<span className="tkg-badge tkg-badge-outline">
													{ctx.t('claim.unclaimed')}
												</span>
											)}
										</div>
									</div>
								</>
							);
							return claimed ? (
								<div
									key={l.slug}
									className="tkg-card tkg-card-compact sg-card-disabled"
									aria-disabled="true"
								>
									{body}
								</div>
							) : (
								<Link
									key={l.slug}
									className={`tkg-card tkg-card-compact${pick?.slug === l.slug ? ' tkg-card-selected' : ''}`}
									href={ctx.href(
										`/${city.id}/claim?q=${encodeURIComponent(query)}&listing=${l.slug}&step=1`
									)}
									aria-current={pick?.slug === l.slug ? 'true' : undefined}
								>
									{body}
								</Link>
							);
						})}
					</div>
				) : null}
				{shown.some(isClaimed) ? (
					<p className="tkg-small tkg-muted tkg-pad" style={{ marginTop: 8 }}>
						{ctx.t('claim.claimedHelp')}
					</p>
				) : null}
			</section>
			<div className="tkg-bottombar">
				<div className="tkg-bb-info">
					{pick ? (
						<>
							<span className="tkg-strong">{listingTitle(ctx, pick)}</span>
							<small>
								{areaName(ctx, city, pick.area)} · {ctx.t('claim.unclaimed').toLowerCase()}
							</small>
						</>
					) : (
						<small>{ctx.t('claim.pickOne')}</small>
					)}
				</div>
				{pick ? (
					<Link className="tkg-btn" href={ctx.href(`/${city.id}/claim?listing=${pick.slug}&step=2`)}>
						{ctx.t('claim.continue')}
						<Icon name="chevron-right" />
					</Link>
				) : (
					<span className="tkg-btn" aria-disabled="true" style={{ opacity: 0.4 }}>
						{ctx.t('claim.continue')}
						<Icon name="chevron-right" />
					</span>
				)}
			</div>
		</>
	);
}

async function VerifyAndPlan({
	ctx,
	city,
	listing,
	step,
	sp
}: {
	ctx: SgContext;
	city: City;
	listing: Listing;
	step: number;
	sp: Record<string, string | string[] | undefined>;
}) {
	const session = await auth();
	const here = ctx.href(`/${city.id}/claim?listing=${listing.slug}&step=2`);
	const title = listingTitle(ctx, listing);

	if (!session?.user?.id) {
		return (
			<section className="tkg-section sg-grow" style={{ paddingTop: 20 }}>
				<div className="tkg-pad">
					<h1 className="tkg-title" style={{ margin: '0 0 4px' }}>
						{ctx.t('claim.signInTitle', { name: title })}
					</h1>
					<p className="tkg-body tkg-muted" style={{ margin: '0 0 16px' }}>
						{ctx.t('claim.signInBody')}
					</p>
					<div className="tkg-stack">
						<Link
							className="tkg-btn tkg-btn-block"
							href={ctx.href(`/auth/signin?callbackUrl=${encodeURIComponent(here)}`)}
						>
							{ctx.t('claim.signIn')}
						</Link>
						<Link
							className="tkg-btn tkg-btn-secondary tkg-btn-block"
							href={ctx.href(`/auth/register?callbackUrl=${encodeURIComponent(here)}`)}
						>
							{ctx.t('claim.createAccount')}
						</Link>
					</div>
				</div>
			</section>
		);
	}

	const phone = formatThaiPhone(listing.phone);
	const verify = one(sp.verify) === 'sign' ? 'sign' : 'call';
	const contact = (one(sp.phone) ?? '').slice(0, 30);
	const note = (one(sp.note) ?? '').slice(0, 500);
	const plan = one(sp.plan) === 'monthly' ? 'monthly' : 'yearly';
	const pay = one(sp.pay) === 'card' ? 'card' : 'promptpay';

	if (step === 2) {
		return (
			<form className="sg-grow sg-flow-form" action={ctx.href(`/${city.id}/claim`)} method="get">
				<input type="hidden" name="listing" value={listing.slug} />
				<input type="hidden" name="step" value="3" />
				<section className="tkg-section" style={{ paddingTop: 20 }}>
					<div className="tkg-pad">
						<h1 className="tkg-title" style={{ margin: '0 0 4px' }}>
							{ctx.t('claim.step2')}
						</h1>
						<p className="tkg-body tkg-muted" style={{ margin: '0 0 16px' }}>
							{phone ? ctx.t('claim.verifyBody') : ctx.t('claim.verifyBodyNoPhone')}
						</p>
					</div>
					<div className="tkg-rows sg-choice">
						<label className="tkg-row">
							<input type="radio" name="verify" value="call" defaultChecked={verify === 'call'} />
							<span className="sg-radio" aria-hidden="true" />
							<span className="tkg-row-main">
								{phone ? ctx.t('claim.verifyCall', { phone }) : ctx.t('claim.verifyCallMe')}
								<small>{phone ? ctx.t('claim.verifyCallSub') : ctx.t('claim.verifyCallMeSub')}</small>
							</span>
						</label>
						<label className="tkg-row">
							<input type="radio" name="verify" value="sign" defaultChecked={verify === 'sign'} />
							<span className="sg-radio" aria-hidden="true" />
							<span className="tkg-row-main">
								{ctx.t('claim.verifySign')}
								<small>{ctx.t('claim.verifySignSub')}</small>
							</span>
						</label>
					</div>
					<div className="tkg-form" style={{ marginTop: 20 }}>
						<div className="tkg-field">
							<label htmlFor="claim-phone">
								{ctx.t('claim.contactPhone')}{' '}
								<small>· {phone ? ctx.t('owner.optional') : ctx.t('claim.required')}</small>
							</label>
							<input
								id="claim-phone"
								className="tkg-input"
								name="phone"
								type="tel"
								inputMode="tel"
								defaultValue={contact}
								required={!phone}
								autoComplete="tel"
							/>
							<span className="tkg-help">{ctx.t('claim.contactPhoneHelp')}</span>
						</div>
						<div className="tkg-field">
							<label htmlFor="claim-note">
								{ctx.t('claim.note')} <small>· {ctx.t('owner.optional')}</small>
							</label>
							<textarea
								id="claim-note"
								className="tkg-input"
								name="note"
								rows={3}
								defaultValue={note}
								maxLength={500}
							/>
						</div>
						<p className="tkg-small tkg-muted" style={{ margin: 0 }}>
							{ctx.t('claim.account', { email: session.user.email ?? '' })}
						</p>
					</div>
				</section>
				<div className="tkg-bottombar">
					<div className="tkg-bb-info">
						<span className="tkg-strong">{title}</span>
						<small>{areaName(ctx, city, listing.area)}</small>
					</div>
					<button className="tkg-btn" type="submit">
						{ctx.t('claim.continue')}
						<Icon name="chevron-right" />
					</button>
				</div>
			</form>
		);
	}

	if (step === 3) {
		const photos = await listClaimPhotos(session.user.id, city.id, listing.slug);
		const initial = Object.fromEntries(photos.map((p) => [p.kind, p.id]));
		const q = new URLSearchParams({ listing: listing.slug, step: '4', verify, phone: contact, note });
		const slot = (k: 'Front' | 'Inside' | 'Menu') => ({
			title: ctx.t(`claim.photo${k}`),
			tip: ctx.t(`claim.photo${k}Tip`),
			tag: ctx.t(`claim.photo${k}Tag`)
		});
		return (
			<div className="sg-grow sg-flow-form">
				<section className="tkg-section" style={{ paddingTop: 20, paddingBottom: 16 }}>
					<div className="tkg-pad">
						<h1 className="tkg-title" style={{ margin: '0 0 4px' }}>
							{ctx.t('claim.photosTitle')}
						</h1>
						<p className="tkg-body tkg-muted" style={{ margin: '0 0 16px' }}>
							{ctx.t('claim.photosBody')}
						</p>
					</div>
					<ClaimPhotos
						city={city.id}
						listing={listing.slug}
						initial={initial}
						slots={{ front: slot('Front'), inside: slot('Inside'), menu: slot('Menu') }}
						labels={{
							take: ctx.t('claim.photoTake'),
							retake: ctx.t('claim.photoRetake'),
							uploading: ctx.t('claim.photoUploading'),
							notAnImage: ctx.t('owner.photosNotImage'),
							tooLarge: ctx.t('owner.photosTooLarge'),
							failed: ctx.t('owner.photosFailed'),
							signedOut: ctx.t('owner.signInTitle'),
							needFront: ctx.t('claim.photoNeedFront'),
							continueLabel: ctx.t('claim.continue')
						}}
						next={ctx.href(`/${city.id}/claim?${q.toString()}`)}
						summary={{ title, sub: areaName(ctx, city, listing.area) }}
					/>
					<p className="tkg-help tkg-pad" style={{ marginTop: 12 }}>
						{ctx.t('claim.photoNote')}
					</p>
				</section>
			</div>
		);
	}

	return (
		<form className="sg-grow sg-flow-form" action={submitClaim}>
			<input type="hidden" name="locale" value={ctx.locale} />
			<input type="hidden" name="city" value={city.id} />
			<input type="hidden" name="listing" value={listing.slug} />
			<input type="hidden" name="verify" value={verify} />
			<input type="hidden" name="phone" value={contact} />
			<input type="hidden" name="note" value={note} />
			<section className="tkg-section" style={{ paddingTop: 20 }}>
				<div className="tkg-pad">
					<h1 className="tkg-title" style={{ margin: '0 0 12px' }}>
						{ctx.t('claim.choosePlan')}
					</h1>
				</div>
				<div className="tkg-plans" role="radiogroup" aria-label={ctx.t('claim.choosePlan')}>
					<label className="tkg-plan sg-plan">
						<input type="radio" name="plan" value="monthly" defaultChecked={plan === 'monthly'} />
						<span className="tkg-radio" aria-hidden="true" />
						<div className="tkg-plan-name">{ctx.t('claim.monthly')}</div>
						<div className="tkg-plan-price">
							฿100 <small>{ctx.t('claim.perMonth')}</small>
						</div>
						<div className="tkg-plan-note">{ctx.t('claim.cancelAnyTime')}</div>
					</label>
					<label className="tkg-plan sg-plan">
						<input type="radio" name="plan" value="yearly" defaultChecked={plan === 'yearly'} />
						<span className="tkg-badge tkg-badge-sun">{ctx.t('claim.twoMonthsFree')}</span>
						<span className="tkg-radio" aria-hidden="true" />
						<div className="tkg-plan-name">{ctx.t('claim.yearly')}</div>
						<div className="tkg-plan-price">
							฿1,000 <small>{ctx.t('claim.perYear')}</small>
						</div>
						<div className="tkg-plan-note">{ctx.t('claim.yearlyNote')}</div>
					</label>
				</div>
				<div className="tkg-pad" style={{ paddingTop: 20 }}>
					<h2 className="tkg-heading" style={{ margin: '0 0 8px' }}>
						{ctx.t('claim.payWith')}
					</h2>
				</div>
				<div className="tkg-rows sg-choice">
					<label className="tkg-row">
						<input type="radio" name="pay" value="promptpay" defaultChecked={pay === 'promptpay'} />
						<span className="sg-radio" aria-hidden="true" />
						<span className="tkg-row-main">
							{ctx.t('claim.promptpay')}
							<small>{ctx.t('claim.promptpaySub')}</small>
						</span>
					</label>
					<label className="tkg-row">
						<input type="radio" name="pay" value="card" defaultChecked={pay === 'card'} />
						<span className="sg-radio" aria-hidden="true" />
						<span className="tkg-row-main">
							{ctx.t('claim.card')}
							<small>{ctx.t('claim.cardSub')}</small>
						</span>
					</label>
				</div>
				<p className="tkg-info" style={{ marginTop: 16 }}>
					<Icon name="info" />
					<span>{ctx.t('claim.payManual')}</span>
				</p>
				<div className="tkg-pad" style={{ paddingTop: 12, paddingBottom: 16 }}>
					<div className="tkg-small tkg-muted">
						{ctx.t('claim.terms', { email: session.user.email ?? '' })}
					</div>
				</div>
			</section>
			<div className="tkg-bottombar">
				<div className="tkg-bb-info">
					<span className="tkg-strong">{title}</span>
					<small>{ctx.t('claim.summarySub')}</small>
				</div>
				<button className="tkg-btn" type="submit">
					<Icon name="check" />
					{ctx.t('claim.send')}
				</button>
			</div>
		</form>
	);
}
