import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { auth, signOut } from '@/lib/auth';
import { safePublicUrl } from '@/lib/soiguru/public-site';

/**
 * Sign out (`/auth/signout?to=<public url>`), linked from the account menu on soiguru.com
 * (spec 058). Signing out is a POST (a server action), so a link elsewhere cannot sign
 * anyone out. Afterwards the visitor goes back to `to` through `/return`.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: 'soiguru.account' });
	return { title: { absolute: t('metaSignOut') }, robots: { index: false, follow: false } };
}

async function signOutAction(formData: FormData) {
	'use server';
	const to = safePublicUrl(String(formData.get('to') ?? ''));
	await signOut({ redirectTo: `/return?to=${encodeURIComponent(to)}` });
}

export default async function SignOutPage({ params, searchParams }: { params: Params; searchParams: Search }) {
	const { locale } = await params;
	setRequestLocale(locale);
	const to = safePublicUrl(one((await searchParams).to));
	const t = await getTranslations({ locale, namespace: 'soiguru.account' });
	const session = await auth();
	const prefix = locale === 'en' ? '' : `/${locale}`;

	if (!session?.user) {
		return (
			<section className="sg-auth-card" aria-labelledby="sg-auth-title">
				<h1 id="sg-auth-title" className="sg-auth-title">
					{t('signedOutTitle')}
				</h1>
				<p className="sg-auth-lead">{t('signedOutBody')}</p>
				<div className="sg-auth-actions">
					<a
						className="sg-auth-btn"
						href={`${prefix}/auth/signin?callbackUrl=${encodeURIComponent(`/return?to=${encodeURIComponent(to)}`)}`}
					>
						{t('signIn')}
					</a>
					<a className="sg-auth-btn sg-auth-btn-secondary" href={to}>
						{t('back')}
					</a>
				</div>
			</section>
		);
	}

	return (
		<section className="sg-auth-card" aria-labelledby="sg-auth-title">
			<h1 id="sg-auth-title" className="sg-auth-title">
				{t('signOutTitle')}
			</h1>
			<p className="sg-auth-lead">{t('signOutBody')}</p>
			<form action={signOutAction} className="sg-auth-actions">
				<input type="hidden" name="to" value={to} />
				<button type="submit" className="sg-auth-btn">
					{t('signOut')}
				</button>
				<a className="sg-auth-btn sg-auth-btn-secondary" href={to}>
					{t('cancel')}
				</a>
			</form>
		</section>
	);
}
