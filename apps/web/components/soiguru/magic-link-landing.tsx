'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getSession, signIn } from 'next-auth/react';
import { Link } from '@/i18n/navigation';
import { isValidCallbackUrl } from '@/lib/auth/validate-callback-url';
import './magic-link.css';

/**
 * Landing page of an emailed sign-in link (spec 073): `/auth/magic-link?token=…`.
 *
 * Signs in from the browser (`signIn('magic-link')`, so the session cookie is set by the
 * standard callback route) and then goes to `callbackUrl`, else the owner area or the admin.
 * The token is only spent by this POST, not by opening the URL, so mail scanners that fetch
 * links do not use it up.
 */
export function MagicLinkLanding() {
	const t = useTranslations('soiguru.account');
	const locale = useLocale();
	const searchParams = useSearchParams();
	const token = searchParams.get('token') ?? '';
	const rawCallback = searchParams.get('callbackUrl');
	const callbackUrl = isValidCallbackUrl(rawCallback) ? (rawCallback as string) : null;
	const [status, setStatus] = useState<'checking' | 'invalid'>(token ? 'checking' : 'invalid');
	const startedRef = useRef(false);

	useEffect(() => {
		if (!token || startedRef.current) return;
		startedRef.current = true;
		(async () => {
			try {
				const res = await signIn('magic-link', { token, redirect: false });
				if (!res || res.error || res.ok === false) {
					setStatus('invalid');
					return;
				}
				const session = await getSession();
				const target = callbackUrl || (session?.user?.isAdmin ? '/admin' : '/client/dashboard');
				const prefixed = locale !== 'en' && !target.startsWith(`/${locale}`) ? `/${locale}${target}` : target;
				window.location.href = prefixed;
			} catch {
				setStatus('invalid');
			}
		})();
	}, [token, callbackUrl, locale]);

	if (status === 'checking') {
		return (
			<section className="sg-auth-card" aria-labelledby="sg-auth-title" aria-busy="true">
				<div className="sg-ml-landing" role="status">
					<div className="sg-ml-spinner" aria-hidden="true" />
					<h1 id="sg-auth-title" className="sg-auth-title">
						{t('magicCheckingTitle')}
					</h1>
					<p className="sg-auth-lead">{t('magicCheckingBody')}</p>
				</div>
			</section>
		);
	}

	return (
		<section className="sg-auth-card" aria-labelledby="sg-auth-title">
			<h1 id="sg-auth-title" className="sg-auth-title">
				{t('magicInvalidTitle')}
			</h1>
			<p className="sg-auth-lead">{t('magicInvalidBody')}</p>
			<div className="sg-auth-actions">
				<Link
					className="sg-auth-btn"
					href={callbackUrl ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/auth/signin'}
				>
					{t('magicRequestNew')}
				</Link>
			</div>
		</section>
	);
}
