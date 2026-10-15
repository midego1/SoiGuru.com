import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { EditorBar, OwnerBar, SavedNote, SaveBar, SignInPrompt } from '@/components/soiguru/owner';
import { saveHours } from '../../../../actions';
import { getSgContext, listingTitle } from '@/lib/soiguru/context';
import { formatMinutes } from '@/lib/soiguru/hours';
import { getEditAccess } from '@/lib/soiguru/owner-access';
import { WEEKDAYS, type TimeRange } from '@/lib/soiguru/types';

/**
 * OwnerDashboard · Hours: a row per day with an open switch and up to two
 * time ranges, "Copy Mon to all", and a temporary notice line. Native
 * checkbox and time inputs, so it works without script.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; city: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: `${ctx.t('owner.hours')} · ${ctx.t('owner.metaTitle')}` }, robots: { index: false } };
}

/** Time input value; 24:00 is shown as 23:59, which saves back as 24:00. */
const t = (m: number | undefined) => (m === undefined ? '' : m >= 1440 ? '23:59' : formatMinutes(m));

export default async function HoursPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale, city: cityId, slug } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const path = `/owner/${cityId}/${slug}/hours`;
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
	const { listing: l, city } = access;

	return (
		<form className="sg-page sg-owner" action={saveHours}>
			<input type="hidden" name="locale" value={locale} />
			<input type="hidden" name="city" value={city.id} />
			<input type="hidden" name="listing" value={l.slug} />
			{/* First submit button = what Enter does: a plain save, not "Copy Mon to all". */}
			<button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
			<EditorBar ctx={ctx} title={ctx.t('owner.hours')} listingName={listingTitle(ctx, l)} />
			{sp.saved ? <SavedNote ctx={ctx} /> : null}

			<section className="tkg-section sg-grow" style={{ paddingTop: 16, paddingBottom: 24 }}>
				<div className="tkg-section-h">
					<h2>
						{ctx.t('owner.hours')}
						<small>{ctx.t('owner.hoursHelp')}</small>
					</h2>
					<button
						className="tkg-btn tkg-btn-ghost tkg-btn-sm"
						type="submit"
						name="copy"
						value="mon"
						style={{ paddingRight: 0 }}
					>
						{ctx.t('owner.copyMon')}
					</button>
				</div>
				<div className="tkg-rows sg-hours-edit">
					{WEEKDAYS.map((day) => {
						const ranges: TimeRange[] = l.hours[day] ?? [];
						const open = ranges.length > 0;
						const [a, b] = ranges;
						return (
							<div key={day} className="tkg-row">
								<label className="sg-switch">
									<input
										type="checkbox"
										name={`${day}_open`}
										defaultChecked={open}
										aria-label={ctx.t('owner.openOn', { day: ctx.t(`days.${day}`) })}
									/>
									<span className="tkg-toggle" aria-hidden="true" />
								</label>
								<div className="tkg-row-main">
									{ctx.t(`days.${day}`)}
									<small className="sg-closed-label">{ctx.t('owner.closedDay')}</small>
								</div>
								<div className="sg-ranges">
									<span className="sg-range">
										<input
											className="tkg-input"
											type="time"
											name={`${day}_from1`}
											defaultValue={t(a?.start) || '09:00'}
											aria-label={ctx.t('owner.opens')}
										/>
										<span className="tkg-muted">–</span>
										<input
											className="tkg-input"
											type="time"
											name={`${day}_to1`}
											defaultValue={t(a?.end) || '18:00'}
											aria-label={ctx.t('owner.closes')}
										/>
									</span>
									<span className="sg-range">
										<input
											className="tkg-input"
											type="time"
											name={`${day}_from2`}
											defaultValue={t(b?.start)}
											aria-label={ctx.t('owner.opens2')}
										/>
										<span className="tkg-muted">–</span>
										<input
											className="tkg-input"
											type="time"
											name={`${day}_to2`}
											defaultValue={t(b?.end)}
											aria-label={ctx.t('owner.closes2')}
										/>
									</span>
								</div>
							</div>
						);
					})}
				</div>
				<p className="tkg-small tkg-muted tkg-pad" style={{ marginTop: 8 }}>
					{ctx.t('owner.secondRangeHelp')}
				</p>
				<div className="tkg-form" style={{ paddingTop: 12 }}>
					<div className="tkg-field">
						<label htmlFor="f-note">
							{ctx.t('owner.hoursNote')} <small>· {ctx.t('owner.optional')}</small>
						</label>
						<input
							id="f-note"
							className="tkg-input"
							name="hours_note"
							defaultValue={l.hoursNote ?? ''}
							placeholder={ctx.t('owner.hoursNotePlaceholder')}
							maxLength={160}
						/>
					</div>
				</div>
			</section>
			<SaveBar ctx={ctx} />
		</form>
	);
}
