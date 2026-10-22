import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { EditorBar, OwnerBar, SavedNote, SignInPrompt } from '@/components/soiguru/owner';
import { PhotoUpload } from '@/components/soiguru/photo-upload';
import { EXAMPLES } from '@/components/soiguru/photo-examples';
import { coverPhoto, removePhoto } from '../../../../actions';
import { getSgContext, listingTitle } from '@/lib/soiguru/context';
import { getEditAccess } from '@/lib/soiguru/owner-access';
import { MAX_PHOTOS } from '@/lib/soiguru/photos';

/**
 * OwnerDashboard · Photos (spec 061): the listing's photos with "Make first" and "Remove", and
 * an upload button for up to eight. The first photo is the big one on the listing and the card
 * photo. Owner photos replace the Google photos visitors see until then.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; city: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: `${ctx.t('owner.photos')} · ${ctx.t('owner.metaTitle')}` }, robots: { index: false } };
}

export default async function PhotosPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale, city: cityId, slug } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const path = `/owner/${cityId}/${slug}/photos`;
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
	const left = Math.max(0, MAX_PHOTOS - l.images.length);

	return (
		<div className="sg-page sg-owner">
			<EditorBar ctx={ctx} title={ctx.t('owner.photos')} listingName={listingTitle(ctx, l)} />
			{sp.saved ? <SavedNote ctx={ctx} /> : null}
			<section className="tkg-section sg-grow" style={{ paddingTop: 20, paddingBottom: 24 }}>
				<div className="tkg-pad">
					<p className="tkg-body tkg-muted" style={{ margin: '0 0 16px' }}>
						{l.images.length ? ctx.t('owner.photosIntro') : ctx.t('owner.photosEmpty')}
					</p>
					{l.images.length > 0 ? (
						<ul className="sg-owner-photos">
							{l.images.map((url, i) => (
								<li key={url}>
									<img src={url} alt="" loading="lazy" />
									{i === 0 ? (
										<span className="sg-owner-photo-tag">{ctx.t('owner.photosCover')}</span>
									) : null}
									<div className="sg-owner-photo-actions">
										{i > 0 ? (
											<form action={coverPhoto}>
												<input type="hidden" name="locale" value={locale} />
												<input type="hidden" name="city" value={city.id} />
												<input type="hidden" name="listing" value={l.slug} />
												<input type="hidden" name="url" value={url} />
												<button type="submit" className="tkg-btn tkg-btn-secondary tkg-btn-sm">
													{ctx.t('owner.photosMakeCover')}
												</button>
											</form>
										) : null}
										<form action={removePhoto}>
											<input type="hidden" name="locale" value={locale} />
											<input type="hidden" name="city" value={city.id} />
											<input type="hidden" name="listing" value={l.slug} />
											<input type="hidden" name="url" value={url} />
											<button type="submit" className="tkg-btn tkg-btn-danger tkg-btn-sm">
												{ctx.t('owner.photosRemove')}
											</button>
										</form>
									</div>
								</li>
							))}
						</ul>
					) : null}
					{l.images.length < 3 ? (
						<div style={{ margin: '0 -16px 16px' }}>
							<p className="tkg-small tkg-muted tkg-pad" style={{ margin: '0 0 8px' }}>
								{ctx.t('owner.photosGuide')}
							</p>
							<div className="sg-cp-slots">
								{(['Front', 'Inside', 'Menu'] as const).map((k) => {
									const Example = EXAMPLES[k.toLowerCase() as 'front' | 'inside' | 'menu'];
									return (
										<div key={k} className="sg-cp-slot">
											<div className="sg-cp-pic">
												<Example />
												<span className="sg-cp-tag">{ctx.t(`claim.photo${k}Tag`)}</span>
											</div>
											<div>
												<div className="tkg-strong">{ctx.t(`claim.photo${k}`)}</div>
												<p className="tkg-help" style={{ margin: '2px 0 0' }}>
													{ctx.t(`claim.photo${k}Tip`)}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					) : null}
					<PhotoUpload
						city={city.id}
						listing={l.slug}
						left={left}
						labels={{
							add: left > 0 ? ctx.t('owner.photosAdd', { left }) : ctx.t('owner.photosFull'),
							uploading: ctx.t('owner.photosUploading'),
							tooMany: ctx.t('owner.photosTooMany', { max: MAX_PHOTOS }),
							notAnImage: ctx.t('owner.photosNotImage'),
							tooLarge: ctx.t('owner.photosTooLarge'),
							failed: ctx.t('owner.photosFailed'),
							signedOut: ctx.t('owner.signInTitle')
						}}
					/>
					<p className="tkg-help" style={{ marginTop: 12 }}>
						{ctx.t('owner.photosTips')}
					</p>
					<p className="tkg-help">{ctx.t('owner.photosPublish')}</p>
				</div>
			</section>
		</div>
	);
}
