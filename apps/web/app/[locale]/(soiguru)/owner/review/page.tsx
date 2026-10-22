import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { Icon } from '@/components/soiguru/icon';
import { OwnerBar, SignInPrompt } from '@/components/soiguru/owner';
import { reviewClaim } from '../../actions';
import { getRecentDecisions, getReviewQueue, PLAN_PRICE_THB, userIsAdmin } from '@/lib/soiguru/claims';
import { listClaimPhotos } from '@/lib/soiguru/claim-photos';
import { getCityListings } from '@/lib/soiguru/content';
import { formatDay, getSgContext, listingPath, listingTitle } from '@/lib/soiguru/context';
import { formatThaiPhone } from '@/lib/soiguru/format';
import type { Listing } from '@/lib/soiguru/types';

/**
 * Claim review (`/owner/review`, admins only). Verification and payment are
 * manual: call the number on the listing, confirm the PromptPay or card
 * payment, then approve. Approval marks the listing as claimed and gives the
 * owner the dashboard.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: `${ctx.t('owner.reviewTitle')} · SoiGuru` }, robots: { index: false } };
}

export default async function ReviewPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const session = await auth();
	if (!session?.user?.id) {
		return (
			<div className="sg-page sg-owner">
				<OwnerBar ctx={ctx} langPath="/owner/review" />
				<SignInPrompt ctx={ctx} back={ctx.href('/owner/review')} />
			</div>
		);
	}
	if (!(await userIsAdmin(session.user.id))) notFound();

	const [queue, recent] = await Promise.all([getReviewQueue(), getRecentDecisions()]);
	const cache = new Map<string, Listing[]>();
	const find = async (city: string, slug: string) => {
		if (!cache.has(city)) cache.set(city, await getCityListings(city));
		return cache.get(city)!.find((l) => l.slug === slug);
	};
	const rows = await Promise.all(
		queue.map(async (c) => ({
			claim: c,
			listing: await find(c.city, c.listingSlug),
			photos: await listClaimPhotos(c.userId, c.city, c.listingSlug)
		}))
	);
	const done = Array.isArray(sp.done) ? sp.done[0] : sp.done;

	return (
		<div className="sg-page sg-owner">
			<header className="tkg-topbar">
				<Link className="tkg-iconbtn" href={ctx.href('/owner')} aria-label={ctx.t('results.back')}>
					<Icon name="chevron-left" />
				</Link>
				<div className="sg-bar-title">
					{ctx.t('owner.reviewTitle')}
					<small>{ctx.t('owner.adminQueue', { count: queue.length })}</small>
				</div>
			</header>
			{done ? (
				<p className="tkg-info sg-sample" role="status">
					<Icon name="check" />
					<span>{done === 'approved' ? ctx.t('owner.approvedNote') : ctx.t('owner.rejectedNote')}</span>
				</p>
			) : null}
			<p className="tkg-small tkg-muted tkg-pad" style={{ margin: '12px 0 0' }}>
				{ctx.t('owner.reviewHelp')}
			</p>

			<section className="tkg-section">
				{rows.length ? (
					<div className="tkg-stack tkg-pad">
						{rows.map(({ claim: c, listing: l, photos }) => (
							<form key={c.id} className="sg-owner-card" action={reviewClaim}>
								<input type="hidden" name="locale" value={locale} />
								<input type="hidden" name="id" value={c.id} />
								<div className="tkg-hstack" style={{ justifyContent: 'space-between' }}>
									{l ? (
										<Link className="tkg-strong" href={ctx.href(listingPath(l))}>
											{listingTitle(ctx, l)}
										</Link>
									) : (
										<span className="tkg-strong">{c.listingSlug}</span>
									)}
									<span className="tkg-badge tkg-badge-outline">
										{ctx.t(`claim.${c.plan === 'monthly' ? 'monthly' : 'yearly'}`)} · ฿
										{PLAN_PRICE_THB[c.plan === 'monthly' ? 'monthly' : 'yearly'].toLocaleString(
											'en-US'
										)}
									</span>
								</div>
								<dl className="sg-facts">
									<dt>{ctx.t('owner.listingPhone')}</dt>
									<dd className="sg-copy">{formatThaiPhone(l?.phone) ?? '–'}</dd>
									<dt>{ctx.t('owner.claimant')}</dt>
									<dd className="sg-copy">{c.email ?? '–'}</dd>
									{c.contactPhone ? (
										<>
											<dt>{ctx.t('claim.contactPhone')}</dt>
											<dd className="sg-copy">{c.contactPhone}</dd>
										</>
									) : null}
									<dt>{ctx.t('owner.verification')}</dt>
									<dd>
										{c.verification === 'sign'
											? ctx.t('claim.verifySign')
											: ctx.t('owner.verifyByCall')}
									</dd>
									<dt>{ctx.t('claim.payWith')}</dt>
									<dd>{ctx.t(c.paymentMethod === 'card' ? 'claim.card' : 'claim.promptpay')}</dd>
									<dt>{ctx.t('owner.filed')}</dt>
									<dd>{formatDay(ctx, c.createdAt)}</dd>
									{c.note ? (
										<>
											<dt>{ctx.t('claim.note')}</dt>
											<dd>{c.note}</dd>
										</>
									) : null}
								</dl>
								<div className="tkg-small tkg-muted" style={{ marginTop: 8 }}>
									{ctx.t('owner.reviewPhotos')}
									{photos.length ? '' : ` · ${ctx.t('owner.reviewPhotosNone')}`}
								</div>
								{photos.length ? (
									<div className="sg-review-photos">
										{photos.map((p) => (
											<figure key={p.id}>
												<img src={`/api/soiguru/claim/photos/${p.id}`} alt="" loading="lazy" />
												<figcaption>
													{ctx.t(
														`claim.photo${p.kind === 'front' ? 'Front' : p.kind === 'inside' ? 'Inside' : 'Menu'}`
													)}
												</figcaption>
											</figure>
										))}
									</div>
								) : null}
								<div className="tkg-field" style={{ marginTop: 8 }}>
									<label htmlFor={`n-${c.id}`}>
										{ctx.t('owner.reviewNote')} <small>· {ctx.t('owner.optional')}</small>
									</label>
									<input id={`n-${c.id}`} className="tkg-input" name="review_note" maxLength={300} />
								</div>
								<div className="tkg-hstack" style={{ marginTop: 12, gap: 8 }}>
									<button
										className="tkg-btn tkg-btn-sm"
										type="submit"
										name="decision"
										value="approve"
									>
										<Icon name="check" />
										{ctx.t('owner.approve')}
									</button>
									<button
										className="tkg-btn tkg-btn-danger tkg-btn-sm"
										type="submit"
										name="decision"
										value="reject"
									>
										{ctx.t('owner.reject')}
									</button>
								</div>
							</form>
						))}
					</div>
				) : (
					<p className="tkg-body tkg-muted tkg-pad">{ctx.t('owner.reviewEmpty')}</p>
				)}
			</section>

			{recent.length ? (
				<section className="tkg-section sg-grow" style={{ paddingBottom: 24 }}>
					<div className="tkg-section-h">
						<h2>{ctx.t('owner.recent')}</h2>
					</div>
					<div className="tkg-rows">
						{recent.map((c) => (
							<div key={c.id} className="tkg-row">
								<Icon name={c.status === 'approved' ? 'check' : 'close'} />
								<span className="tkg-row-main">
									{c.city}/{c.listingSlug}
									<small>
										{c.email} · {formatDay(ctx, c.reviewedAt)}
										{c.reviewNote ? ` · ${c.reviewNote}` : ''}
									</small>
								</span>
							</div>
						))}
					</div>
				</section>
			) : (
				<div className="sg-grow" />
			)}
		</div>
	);
}
