import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CredentialsForm } from '@/app/[locale]/auth/components/credentials-form';
import { SocialLogin } from '@/app/[locale]/auth/components/social-login';
import { PUBLIC_SITE } from '@/lib/soiguru/public-site';
import { MagicLinkSignIn } from '@/components/soiguru/magic-link-sign-in';

/**
 * The SoiGuru sign-in and create-account card (spec 058): SoiGuru's own heading and copy,
 * then the template's credentials form (without its own heading) and the social buttons.
 * The form keeps every behaviour of the template: callback URL, 2FA, captcha, locale.
 * Creating an account also shows the password rule and a Terms / Privacy line (PDPA).
 */
export async function SoiGuruAuthCard({ form, locale }: { form: 'login' | 'signup'; locale: string }) {
	const t = await getTranslations({ locale, namespace: 'soiguru.account' });
	const isLogin = form === 'login';
	const perks = [t('perkSaved'), t('perkOwner'), t('perkFree')];
	return (
		<section className="sg-auth-card" aria-labelledby="sg-auth-title">
			<h1 id="sg-auth-title" className="sg-auth-title">
				{isLogin ? t('signInTitle') : t('registerTitle')}
			</h1>
			<p className="sg-auth-lead">{isLogin ? t('signInBody') : t('registerBody')}</p>
			{!isLogin && (
				<ul className="sg-auth-perks">
					{perks.map((p) => (
						<li key={p}>
							<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
								<path
									d="M5 12.5l4.5 4.5L19 7.5"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.4"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<span>{p}</span>
						</li>
					))}
				</ul>
			)}
			<div className="sg-auth-form">
				<Suspense fallback={null}>
					{/* Spec 073: the emailed sign-in link first, the password form behind "Use a password instead". */}
					<MagicLinkSignIn mode={form}>
						<CredentialsForm type={form} hideHeader passwordHint={isLogin ? undefined : t('passwordHint')}>
							<SocialLogin />
						</CredentialsForm>
					</MagicLinkSignIn>
				</Suspense>
			</div>
			{!isLogin && (
				<p className="sg-auth-terms">
					{t.rich('termsNote', {
						terms: (chunks) => <a href={`${PUBLIC_SITE}/terms`}>{chunks}</a>,
						privacy: (chunks) => <a href={`${PUBLIC_SITE}/privacy`}>{chunks}</a>
					})}
				</p>
			)}
			<p className="sg-auth-note">{t('ownerNote')}</p>
		</section>
	);
}
