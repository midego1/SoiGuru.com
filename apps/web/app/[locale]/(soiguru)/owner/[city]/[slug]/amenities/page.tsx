import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { EditSplit, EditorBar, OwnerBar, SavedNote, SaveBar, SignInPrompt } from '@/components/soiguru/owner';
import { LivePreview, PreviewOpenButton } from '@/components/soiguru/live-preview';
import { saveAmenities } from '../../../../actions';
import { getAmenities } from '@/lib/soiguru/content';
import { getSgContext, listingTitle } from '@/lib/soiguru/context';
import { getAmenityNames, getPreviewBase } from '@/lib/soiguru/live-preview-server';
import { getEditAccess } from '@/lib/soiguru/owner-access';

/**
 * OwnerDashboard · Good to know: every amenity from `amenities.yml` as
 * Yes / No / Not set. "No" is shown to visitors too ("No parking"), so
 * "Not set" is the honest default.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; city: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return {
		title: { absolute: `${ctx.t('owner.goodToKnow')} · ${ctx.t('owner.metaTitle')}` },
		robots: { index: false }
	};
}

export default async function AmenitiesPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale, city: cityId, slug } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const path = `/owner/${cityId}/${slug}/amenities`;
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
	const [previewBase, amenityNames] = await Promise.all([getPreviewBase(l, city, ctx.thai), getAmenityNames()]);
	const all = await getAmenities();
	const current = new Map(l.amenities.map((a) => [a.id, a.available]));
	const ids = [...new Set([...all.keys(), ...current.keys()])];

	return (
		<form className="sg-page sg-owner" action={saveAmenities}>
			<input type="hidden" name="locale" value={locale} />
			<input type="hidden" name="city" value={city.id} />
			<input type="hidden" name="listing" value={l.slug} />
			<EditorBar
				ctx={ctx}
				title={ctx.t('owner.goodToKnow')}
				listingName={listingTitle(ctx, l)}
				action={<PreviewOpenButton />}
			/>
			{sp.saved ? <SavedNote ctx={ctx} /> : null}
			<EditSplit preview={<LivePreview base={previewBase} focus={['amenities']} amenityNames={amenityNames} />}>
				<section className="tkg-section sg-grow" style={{ paddingTop: 16, paddingBottom: 24 }}>
					<div className="tkg-section-h">
						<h2>
							{ctx.t('owner.goodToKnow')}
							<small>{ctx.t('owner.amenitiesHelp')}</small>
						</h2>
					</div>
					<div className="tkg-rows">
						{ids.map((id) => {
							const a = all.get(id);
							const label = a ? (ctx.thai && a.name_th) || a.name : id.replace(/-/g, ' ');
							const other = a ? (ctx.thai ? a.name : a.name_th) : undefined;
							const value = current.has(id) ? (current.get(id) ? 'yes' : 'no') : '';
							return (
								<div key={id} className="tkg-row">
									<span className="tkg-row-main">
										{label}
										{other ? <small>{other}</small> : null}
									</span>
									<span className="tkg-seg sg-seg-radio" role="radiogroup" aria-label={label}>
										{(['yes', 'no', ''] as const).map((v) => (
											<label key={v || 'unset'}>
												<input
													type="radio"
													name={`amenity_${id}`}
													value={v}
													defaultChecked={value === v}
												/>
												<span>
													{ctx.t(
														v === 'yes'
															? 'owner.yes'
															: v === 'no'
																? 'owner.no'
																: 'owner.unset'
													)}
												</span>
											</label>
										))}
									</span>
								</div>
							);
						})}
					</div>
				</section>
			</EditSplit>
			<SaveBar ctx={ctx} />
		</form>
	);
}
