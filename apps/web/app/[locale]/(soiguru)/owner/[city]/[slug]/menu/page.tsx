import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { EditorBar, OwnerBar, SavedNote, SaveBar, SignInPrompt } from '@/components/soiguru/owner';
import { saveMenu } from '../../../../actions';
import { getSgContext, listingTitle } from '@/lib/soiguru/context';
import { MENU_MAX_SECTIONS, type MenuItem, type MenuSection } from '@/lib/soiguru/menu';
import { getEditAccess } from '@/lib/soiguru/owner-access';

/**
 * OwnerDashboard · Menu & prices (spec 069): the listing's `menu` as sections of rows
 * (name, Thai name, price, "to" price, "from" switch, note). Works for any trade: dishes,
 * treatments, day trips, rental rates. Native inputs only, so it works without script:
 * every section gets a few blank rows and one blank section follows the last; a row with
 * an empty name is dropped on save, which is how rows and sections are removed.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; city: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** Blank rows shown under each section's items (3 for a new section, 2 for an existing one). */
const BLANK_ROWS_NEW = 3;
const BLANK_ROWS_EXISTING = 2;

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

	// The saved sections plus one empty one to start the next (within the limit).
	const sections: MenuSection[] = [...l.menu];
	if (sections.length < MENU_MAX_SECTIONS) sections.push({ items: [] });
	const t = (key: string) => ctx.t(`owner.${key}`);

	const row = (s: number, i: number, item?: MenuItem) => {
		const id = `s${s}_i${i}`;
		return (
			<div key={id} className="sg-menu-row">
				<input
					className="tkg-input sg-menu-f-name"
					name={`${id}_name`}
					defaultValue={item?.name ?? ''}
					placeholder={t('menuItem')}
					aria-label={t('menuItem')}
					maxLength={80}
				/>
				<input
					className="tkg-input sg-menu-f-th"
					name={`${id}_name_th`}
					defaultValue={item?.name_th ?? ''}
					placeholder={t('menuItemTh')}
					aria-label={t('menuItemTh')}
					maxLength={80}
					lang="th"
				/>
				<span className="sg-menu-f-prices">
					<input
						className="tkg-input sg-menu-f-price"
						name={`${id}_price`}
						type="number"
						inputMode="decimal"
						min={0}
						max={999999}
						step="any"
						defaultValue={item?.price ?? ''}
						placeholder={t('menuPrice')}
						aria-label={t('menuPrice')}
					/>
					<span className="tkg-muted">–</span>
					<input
						className="tkg-input sg-menu-f-price"
						name={`${id}_price_max`}
						type="number"
						inputMode="decimal"
						min={0}
						max={999999}
						step="any"
						defaultValue={item?.price_max ?? ''}
						placeholder={t('menuPriceTo')}
						aria-label={t('menuPriceTo')}
					/>
					<label className="sg-menu-f-from">
						<input type="checkbox" name={`${id}_from`} defaultChecked={item?.from === true} />
						<span>{t('menuFrom')}</span>
					</label>
				</span>
				<input
					className="tkg-input sg-menu-f-note"
					name={`${id}_note`}
					defaultValue={item?.note ?? ''}
					placeholder={t('menuItemNotePlaceholder')}
					aria-label={t('menuItemNote')}
					maxLength={80}
				/>
				<input
					className="tkg-input sg-menu-f-note"
					name={`${id}_note_th`}
					defaultValue={item?.note_th ?? ''}
					placeholder={t('menuItemNoteTh')}
					aria-label={t('menuItemNoteTh')}
					maxLength={80}
					lang="th"
				/>
			</div>
		);
	};

	return (
		<form className="sg-page sg-owner" action={saveMenu}>
			<input type="hidden" name="locale" value={locale} />
			<input type="hidden" name="city" value={city.id} />
			<input type="hidden" name="listing" value={l.slug} />
			<EditorBar ctx={ctx} title={t('menu')} listingName={listingTitle(ctx, l)} />
			{sp.saved ? <SavedNote ctx={ctx} /> : null}

			<section className="tkg-section sg-grow" style={{ paddingTop: 16, paddingBottom: 24 }}>
				<div className="tkg-section-h">
					<h2>
						{t('menu')}
						<small>{t('menuHelp')}</small>
					</h2>
				</div>
				<div className="sg-menu-edit">
					{sections.map((s, si) => {
						const isNew = s.items.length === 0;
						const blanks = isNew ? BLANK_ROWS_NEW : BLANK_ROWS_EXISTING;
						return (
							<fieldset key={si} className="sg-menu-section">
								<legend className="sr-only">
									{s.title ?? t('menuNewSection')}
								</legend>
								<div className="sg-menu-section-h">
									<input
										className="tkg-input sg-menu-f-title"
										name={`s${si}_title`}
										defaultValue={s.title ?? ''}
										placeholder={isNew ? t('menuNewSection') : t('menuSectionPlaceholder')}
										aria-label={t('menuSection')}
										maxLength={60}
									/>
									<input
										className="tkg-input sg-menu-f-title"
										name={`s${si}_title_th`}
										defaultValue={s.title_th ?? ''}
										placeholder={t('menuSectionTh')}
										aria-label={t('menuSectionTh')}
										maxLength={60}
										lang="th"
									/>
								</div>
								<div className="sg-menu-rows">
									{s.items.map((item, ii) => row(si, ii, item))}
									{Array.from({ length: blanks }, (_, k) => row(si, s.items.length + k))}
								</div>
							</fieldset>
						);
					})}
				</div>
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
