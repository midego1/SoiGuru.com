import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { EditorBar, OwnerBar, SavedNote, SaveBar, SignInPrompt } from '@/components/soiguru/owner';
import { saveDetails } from '../../../../actions';
import { getCategories } from '@/lib/soiguru/content';
import { getSgContext, listingTitle, localName } from '@/lib/soiguru/context';
import { getEditAccess } from '@/lib/soiguru/owner-access';

/**
 * OwnerDashboard · Details: names and descriptions in English and Thai,
 * category, phone, LINE, WhatsApp, address and the booking note. Saved
 * straight to the listing; visitors see it on the next page load.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; city: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: `${ctx.t('owner.details')} · ${ctx.t('owner.metaTitle')}` }, robots: { index: false } };
}

/** "+66812345678" → "812345678" for the +66 prefix field. */
const local = (e164?: string) => (e164?.startsWith('+66') ? e164.slice(3) : (e164 ?? ''));

export default async function DetailsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale, city: cityId, slug } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const path = `/owner/${cityId}/${slug}/details`;
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
	const categories = await getCategories();

	return (
		<form className="sg-page sg-owner" action={saveDetails}>
			<input type="hidden" name="locale" value={locale} />
			<input type="hidden" name="city" value={city.id} />
			<input type="hidden" name="listing" value={l.slug} />
			<EditorBar ctx={ctx} title={ctx.t('owner.details')} listingName={listingTitle(ctx, l)} />
			{sp.saved ? <SavedNote ctx={ctx} /> : null}

			<div className="tkg-form sg-grow" style={{ paddingTop: 20, paddingBottom: 24 }}>
				<h2 className="tkg-heading sg-form-h">{ctx.t('owner.english')}</h2>
				<div className="tkg-field">
					<label htmlFor="f-name">
						{ctx.t('owner.name')} <small>· English</small>
					</label>
					<input
						id="f-name"
						className="tkg-input"
						name="name"
						defaultValue={l.name}
						required
						maxLength={120}
					/>
				</div>
				<div className="tkg-field">
					<label htmlFor="f-desc">
						{ctx.t('owner.description')} <small>· {ctx.t('owner.descriptionHelp')}</small>
					</label>
					<textarea
						id="f-desc"
						className="tkg-input"
						name="description"
						rows={4}
						maxLength={300}
						defaultValue={l.description ?? ''}
					/>
				</div>

				<h2 className="tkg-heading sg-form-h">ไทย</h2>
				<div className="tkg-field">
					<label htmlFor="f-name-th" lang="th">
						ชื่อร้าน <small>· Thai</small>
					</label>
					<input
						id="f-name-th"
						className="tkg-input tkg-th"
						lang="th"
						name="name_th"
						defaultValue={l.nameTh ?? ''}
						maxLength={120}
					/>
					<span className="tkg-help">{ctx.t('owner.nameThHelp')}</span>
				</div>
				<div className="tkg-field">
					<label htmlFor="f-desc-th" lang="th">
						คำอธิบายสั้นๆ <small>· {ctx.t('owner.descriptionHelp')}</small>
					</label>
					<textarea
						id="f-desc-th"
						className="tkg-input tkg-th"
						lang="th"
						name="description_th"
						rows={4}
						maxLength={300}
						defaultValue={l.descriptionTh ?? ''}
					/>
				</div>

				<h2 className="tkg-heading sg-form-h">{ctx.t('owner.contact')}</h2>
				<div className="tkg-field">
					<label htmlFor="f-cat">{ctx.t('owner.category')}</label>
					<select id="f-cat" className="tkg-input" name="category" defaultValue={l.category.id}>
						{categories.map((c) => (
							<option key={c.id} value={c.id}>
								{localName(ctx, c)}
								{c.name_th && !ctx.thai ? ` · ${c.name_th}` : ''}
							</option>
						))}
					</select>
				</div>
				<div className="tkg-field">
					<label htmlFor="f-phone">{ctx.t('owner.phone')}</label>
					<div className="tkg-input-group">
						<span className="tkg-prefix">+66</span>
						<input
							id="f-phone"
							className="tkg-input"
							name="phone"
							type="tel"
							inputMode="tel"
							defaultValue={local(l.phone)}
							maxLength={30}
						/>
					</div>
				</div>
				<div className="tkg-field">
					<label htmlFor="f-line">
						{ctx.t('owner.lineId')} <small>· {ctx.t('owner.optional')}</small>
					</label>
					<div className="tkg-input-group">
						<span className="tkg-prefix">@</span>
						<input
							id="f-line"
							className="tkg-input"
							name="line_id"
							defaultValue={(l.lineId ?? '').replace(/^@/, '')}
							maxLength={60}
						/>
					</div>
					<span className="tkg-help">{ctx.t('owner.lineHelp')}</span>
				</div>
				<div className="tkg-field">
					<label htmlFor="f-wa">
						WhatsApp <small>· {ctx.t('owner.optional')}</small>
					</label>
					<div className="tkg-input-group">
						<span className="tkg-prefix">+66</span>
						<input
							id="f-wa"
							className="tkg-input"
							name="whatsapp"
							type="tel"
							inputMode="tel"
							defaultValue={local(l.whatsapp)}
							maxLength={30}
						/>
					</div>
				</div>
				<div className="tkg-field">
					<label htmlFor="f-addr">{ctx.t('owner.address')}</label>
					<input
						id="f-addr"
						className="tkg-input"
						name="address"
						defaultValue={l.address ?? ''}
						maxLength={200}
					/>
				</div>
				<div className="tkg-field">
					<label htmlFor="f-book">
						{ctx.t('owner.bookingNote')} <small>· {ctx.t('owner.bookingNoteHelp')}</small>
					</label>
					<input
						id="f-book"
						className="tkg-input"
						name="booking_note"
						defaultValue={l.bookingNote ?? ''}
						maxLength={160}
					/>
				</div>
			</div>
			<SaveBar ctx={ctx} />
		</form>
	);
}
