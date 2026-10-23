import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { EditorBar, OwnerBar, SavedNote, SaveBar, SignInPrompt } from '@/components/soiguru/owner';
import { MenuEditor } from '@/components/soiguru/menu-editor';
import { saveMenu } from '../../../../actions';
import { getSgContext, listingTitle } from '@/lib/soiguru/context';
import { getEditAccess } from '@/lib/soiguru/owner-access';

/**
 * OwnerDashboard · Menu & prices (spec 069): the listing's `menu` as sections of rows
 * (name, Thai name, price, "to" price, "from" switch, note), edited in `MenuEditor` (add,
 * remove and reorder rows, starter sections per trade, paste a list, preview). Works for any
 * trade: dishes, treatments, day trips, rental rates. The fields post to `saveMenu`; a row
 * with an empty name is dropped on save.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; city: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const ctx = await getSgContext(locale);
	return { title: { absolute: `${ctx.t('owner.menu')} · ${ctx.t('owner.metaTitle')}` }, robots: { index: false } };
}

export default async function MenuPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale, city: cityId, slug } = await params;
	setRequestLocale(locale);
	const sp = await searchParams;
	const ctx = await getSgContext(locale);
	const path = `/owner/${cityId}/${slug}/menu`;
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

	const t = (key: string) => ctx.t(`owner.${key}`);
	const categoryName = (ctx.thai && l.category.name_th) || l.category.name;

	return (
		<form className="sg-page sg-owner" action={saveMenu}>
			<input type="hidden" name="locale" value={locale} />
			<input type="hidden" name="city" value={city.id} />
			<input type="hidden" name="listing" value={l.slug} />
			{/* First submit button = what Enter does outside the editor: a plain save. */}
			<button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
			<EditorBar ctx={ctx} title={t('menu')} listingName={listingTitle(ctx, l)} />
			{sp.saved ? <SavedNote ctx={ctx} /> : null}

			<section className="tkg-section sg-grow" style={{ paddingTop: 16, paddingBottom: 24 }}>
				<div className="tkg-section-h">
					<h2>
						{t('menu')}
						<small>{t('menuHelp')}</small>
					</h2>
				</div>
				<MenuEditor initial={l.menu} categoryId={l.category.id} categoryName={categoryName} thai={ctx.thai} />
				<p className="tkg-small tkg-muted tkg-pad" style={{ marginTop: 8 }}>
					{t('menuRowsHelp')}
				</p>
				<div className="tkg-form" style={{ paddingTop: 12 }}>
					<div className="tkg-field">
						<label htmlFor="f-menu-note">
							{t('menuNote')} <small>· {t('optional')}</small>
						</label>
						<input
							id="f-menu-note"
							className="tkg-input"
							name="menu_note"
							defaultValue={l.menuNote ?? ''}
							placeholder={t('menuNotePlaceholder')}
							maxLength={160}
						/>
					</div>
					<div className="tkg-field">
						<label htmlFor="f-menu-note-th">
							{t('menuNoteTh')} <small>· {t('optional')}</small>
						</label>
						<input
							id="f-menu-note-th"
							className="tkg-input"
							name="menu_note_th"
							defaultValue={l.menuNoteTh ?? ''}
							maxLength={160}
							lang="th"
						/>
					</div>
				</div>
			</section>
			<SaveBar ctx={ctx} />
		</form>
	);
}
