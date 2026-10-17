import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/soiguru/icon';
import { EditorBar, OwnerBar, SignInPrompt } from '@/components/soiguru/owner';
import { PLAN_PRICE_THB } from '@/lib/soiguru/claims';
import { formatDay, getSgContext, listingTitle } from '@/lib/soiguru/context';
import { getEditAccess } from '@/lib/soiguru/owner-access';

/**
 * OwnerDashboard · Billing: the plan, when and how it was paid, and when it
 * renews. Payments are confirmed by hand for now, so there is nothing to
 * click here yet besides contacting us.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; city: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: `${ctx.t('owner.billing')} · ${ctx.t('owner.metaTitle')}` }, robots: { index: false } };
}

export default async function BillingPage({ params }: { params: Params }) {
	const { locale, city: cityId, slug } = await params;
	setRequestLocale(locale);
	const ctx = await getSgContext(locale);
	const path = `/owner/${cityId}/${slug}/billing`;
	const access = await getEditAccess(cityId, slug);
	if (access.kind === 'signed-out') {
		return (
			<div className="sg-page sg-owner">
				<OwnerBar ctx={ctx} langPath={path} />
				<SignInPrompt ctx={ctx} back={ctx.href(path)} />
			</div>
		);
	}
	if (access.kind === 'denied') notFound();
	const { listing: l, claim } = access;
	const plan = claim?.plan === 'monthly' ? 'monthly' : 'yearly';
	const active = !!claim?.paidUntil && claim.paidUntil.getTime() > Date.now();

	return (
		<div className="sg-page sg-owner">
			<EditorBar ctx={ctx} title={ctx.t('owner.billingTitle')} listingName={listingTitle(ctx, l)} />
			<section className="tkg-section sg-grow" style={{ paddingTop: 16, paddingBottom: 24 }}>
				<div className="tkg-pad">
					{claim ? (
						<div className="sg-owner-card">
							<div className="tkg-hstack" style={{ justifyContent: 'space-between' }}>
								<span className="tkg-strong">
									{ctx.t('owner.planName', { plan: ctx.t(`claim.${plan}`) })}
								</span>
								<span className={active ? 'tkg-badge' : 'tkg-badge tkg-badge-outline'}>
									{active ? <Icon name="check" /> : null}
									{active ? ctx.t('owner.active') : ctx.t('owner.expired')}
								</span>
							</div>
							<div className="tkg-small tkg-muted" style={{ marginTop: 4 }}>
								{ctx.t('owner.paidLine', {
									amount: `฿${PLAN_PRICE_THB[plan].toLocaleString('en-US')}`,
									paid: formatDay(ctx, claim.paidAt),
									method: ctx.t(claim.paymentMethod === 'card' ? 'claim.card' : 'claim.promptpay'),
									until: formatDay(ctx, claim.paidUntil)
								})}
							</div>
							<div className="tkg-small tkg-muted">{ctx.t('owner.renewNote')}</div>
						</div>
					) : (
						<p className="tkg-body tkg-muted">{ctx.t('owner.adminNoBilling')}</p>
					)}
					<p className="tkg-small tkg-muted" style={{ marginTop: 12 }}>
						{ctx.t('owner.billingHelp')}
					</p>
				</div>
			</section>
		</div>
	);
}
