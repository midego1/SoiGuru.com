'use client';

import { useActionState, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { requestMagicLinkAction, type MagicLinkState } from '@/app/[locale]/auth/magic-link-actions';
import { isValidCallbackUrl } from '@/lib/auth/validate-callback-url';
import './magic-link.css';

/**
 * "Email me a sign-in link" on the SoiGuru sign-in and create-account cards (spec 073).
 *
 * The emailed link is the primary path; the template's password form (passed as `children`)
 * stays one tap away behind "Use a password instead" and keeps every behaviour it had. After
 * sending, the card shows "Check your inbox" with a button that opens the visitor's webmail
 * already searched for our email (Gmail, Outlook, Yahoo, iCloud, Proton).
 */
export function MagicLinkSignIn({ mode, children }: { mode: 'login' | 'signup'; children: React.ReactNode }) {
	const t = useTranslations('soiguru.account');
	const [view, setView] = useState<'link' | 'password'>('link');
	const [attempt, setAttempt] = useState(0);

	return (
		<>
			{view === 'link' ? (
				<>
					<MagicLinkPanel key={attempt} mode={mode} onDifferentEmail={() => setAttempt((n) => n + 1)} />
					<div className="sg-ml-or" role="separator">
						<span>{t('magicOr')}</span>
					</div>
					<button
						type="button"
						className="sg-auth-btn sg-auth-btn-secondary"
						onClick={() => setView('password')}
					>
						{t('magicUsePassword')}
					</button>
				</>
			) : (
				<button type="button" className="sg-ml-switch" onClick={() => setView('link')}>
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
						<path
							d="M4 6.5h16v11H4z M4.5 7l7.5 6 7.5-6"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinejoin="round"
						/>
					</svg>
					<span>{t('magicUseLink')}</span>
				</button>
			)}
			{/* Kept mounted so a half-typed password or a 2FA step survives switching back and forth. */}
			<div hidden={view !== 'password'}>{children}</div>
		</>
	);
}

function MagicLinkPanel({ mode, onDifferentEmail }: { mode: 'login' | 'signup'; onDifferentEmail: () => void }) {
	const t = useTranslations('soiguru.account');
	const locale = useLocale();
	const searchParams = useSearchParams();
	const rawCallback = searchParams.get('redirect') || searchParams.get('callbackUrl');
	const callbackUrl = isValidCallbackUrl(rawCallback) ? (rawCallback as string) : '';
	const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(requestMagicLinkAction, {});

	const hidden = (
		<>
			<input type="hidden" name="locale" value={locale} />
			{callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
		</>
	);

	if (state.success && state.email) {
		return (
			<div className="sg-ml-sent" role="status" aria-live="polite">
				<div className="sg-ml-sent-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
						<path
							d="M3.5 6h17v12h-17z M4 6.5l8 6.5 8-6.5"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
				<h2 className="sg-ml-sent-title">{t('magicSentTitle')}</h2>
				<p className="sg-ml-sent-body">
					{t.rich('magicSentBody', { email: state.email, b: (c) => <strong>{c}</strong> })}
				</p>
				{state.mailbox ? (
					<a className="sg-auth-btn" href={state.mailbox.url} target="_blank" rel="noopener noreferrer">
						{t('magicOpenMailbox', { provider: state.mailbox.label })}
					</a>
				) : (
					<p className="sg-auth-alert sg-auth-alert-info">{t('magicOpenApp')}</p>
				)}
				<p className="sg-auth-hint sg-ml-note">{t('magicSpamNote')}</p>
				<div className="sg-ml-sent-actions">
					<form action={formAction}>
						<input type="hidden" name="email" value={state.email} />
						{hidden}
						<button type="submit" className="sg-ml-link" disabled={pending}>
							{pending ? t('sending') : t('magicResend')}
						</button>
					</form>
					<button type="button" className="sg-ml-link" onClick={onDifferentEmail}>
						{t('magicDifferentEmail')}
					</button>
				</div>
			</div>
		);
	}

	const error = state.error
		? state.error === 'invalid_email'
			? t('magicErrorInvalid')
			: state.error === 'throttled'
				? state.retryAfterSeconds && state.retryAfterSeconds <= 120
					? t('magicErrorThrottledSeconds', { seconds: state.retryAfterSeconds })
					: t('magicErrorThrottled')
				: state.error === 'unavailable'
					? t('magicErrorUnavailable')
					: t('magicErrorFailed')
		: null;

	return (
		<form action={formAction} className="sg-auth-fields">
			<label className="sg-auth-field">
				<span>{t('email')}</span>
				<input
					className="sg-auth-input"
					type="email"
					name="email"
					defaultValue={state.email ?? ''}
					placeholder={t('emailPlaceholder')}
					autoComplete="email"
					inputMode="email"
					required
				/>
			</label>
			{hidden}
			{error ? (
				<div className="sg-auth-alert sg-auth-alert-error" role="alert">
					{error}
				</div>
			) : null}
			<button className="sg-auth-btn" type="submit" disabled={pending}>
				{pending ? t('sending') : t('magicSend')}
			</button>
			<p className="sg-auth-hint sg-ml-note">{mode === 'signup' ? t('magicHintSignup') : t('magicHintLogin')}</p>
		</form>
	);
}
