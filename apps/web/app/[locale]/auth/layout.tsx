import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { SoiGuruMark } from '@/components/soiguru/logo-mark';
import { AuthBackLink } from '@/components/soiguru/auth-back-link';
import { soiguruFontVariables } from '@/lib/soiguru/fonts';
import { PUBLIC_SITE, PUBLIC_SITES } from '@/lib/soiguru/public-site';
import './sg-auth.css';

/**
 * SoiGuru shell for the account screens under `/auth` (sign in, create account, forgot and
 * new password, verification, sign out; spec 058). The template header and footer are left
 * out (`auth` is chromeless in the root layout); a slim bar carries the SoiGuru mark, which
 * goes to the public site, and a "Back to SoiGuru" link to the page the visitor came from.
 */
export default async function AuthLayout({
	children,
	params
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: 'soiguru.account' });
	const home = `${PUBLIC_SITE}/`;
	return (
		<div className={`sg-auth ${soiguruFontVariables}`}>
			<header className="sg-auth-bar">
				<a className="sg-auth-brand" href={home}>
					<SoiGuruMark size={32} />
					<span>SoiGuru</span>
				</a>
				<Suspense fallback={null}>
					<AuthBackLink sites={PUBLIC_SITES} fallback={home} label={t('back')} />
				</Suspense>
			</header>
			<div className="sg-auth-main">{children}</div>
		</div>
	);
}
