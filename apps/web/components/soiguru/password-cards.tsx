'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { ActionState } from '@/lib/auth/middleware';
import { forgotPassword, newPasswordAction, verifyPasswordTokenAction } from '@/app/[locale]/auth/actions';

/**
 * SoiGuru's forgot-password and new-password cards (spec 058, 2026-10-23): the same white
 * card as sign in (`sg-auth-card`), SoiGuru copy in English and Thai, native inputs and the
 * SoiGuru button. They call the template's server actions unchanged (`forgotPassword`,
 * `verifyPasswordTokenAction`, `newPasswordAction`), so tokens, e-mail and rate limits are
 * the template's. The template's own two-column screens stay in `app/[locale]/auth/*-client.tsx`.
 */

function Alert({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: React.ReactNode }) {
	return (
		<div className={`sg-auth-alert sg-auth-alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
			{children}
		</div>
	);
}

export function SoiGuruForgotPasswordCard() {
	const t = useTranslations('soiguru.account');
	const [state, formAction, pending] = useActionState<ActionState, FormData>(forgotPassword, {});
	const sent = Boolean(state.success);
	return (
		<section className="sg-auth-card" aria-labelledby="sg-auth-title">
			<h1 id="sg-auth-title" className="sg-auth-title">
				{sent ? t('sentTitle') : t('forgotTitle')}
			</h1>
			<p className="sg-auth-lead">{sent ? t('sentBody', { email: String(state.email ?? '') }) : t('forgotBody')}</p>
			{sent ? (
				<>
					<Alert tone="info">{t('sentNote')}</Alert>
					<div className="sg-auth-actions">
						<Link className="sg-auth-btn" href="/auth/signin">
							{t('backToSignIn')}
						</Link>
					</div>
				</>
			) : (
				<form action={formAction} className="sg-auth-fields">
					<label className="sg-auth-field">
						<span>{t('email')}</span>
						<input
							className="sg-auth-input"
							type="email"
							id="email"
	name="email"
							placeholder={t('emailPlaceholder')}
							autoComplete="email"
							inputMode="email"
							required
							autoFocus
						/>
					</label>
					{state.error ? <Alert tone="error">{state.error}</Alert> : null}
					<div className="sg-auth-actions">
						<button className="sg-auth-btn" type="submit" disabled={pending}>
							{pending ? t('sending') : t('sendLink')}
						</button>
						<Link className="sg-auth-btn sg-auth-btn-secondary" href="/auth/signin">
							{t('backToSignIn')}
						</Link>
					</div>
				</form>
			)}
			<p className="sg-auth-note">{t('ownerNote')}</p>
		</section>
	);
}

/** The five checks the template's sign-up rules use; three of them make a password acceptable. */
function useChecks() {
	const t = useTranslations('soiguru.account');
	return useMemo(
		() => [
			{ id: 'length', label: t('ruleLength'), ok: (p: string) => p.length >= 8 },
			{ id: 'lower', label: t('ruleLower'), ok: (p: string) => /[a-z]/.test(p) },
			{ id: 'upper', label: t('ruleUpper'), ok: (p: string) => /[A-Z]/.test(p) },
			{ id: 'number', label: t('ruleNumber'), ok: (p: string) => /\d/.test(p) },
			{ id: 'special', label: t('ruleSpecial'), ok: (p: string) => /[!@#$%^&*~(){}[\]|;:'",<>.?_-]/.test(p) }
		],
		[t]
	);
}

export function SoiGuruNewPasswordCard() {
	const t = useTranslations('soiguru.account');
	const searchParams = useSearchParams();
	const token = searchParams.get('token');
	const checks = useChecks();

	const [tokenState, setTokenState] = useState<'checking' | 'valid' | 'invalid'>('checking');
	const [tokenError, setTokenError] = useState('');
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [show, setShow] = useState(false);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);

	useEffect(() => {
		let mounted = true;
		if (!token) {
			setTokenState('invalid');
			return;
		}
		verifyPasswordTokenAction(token)
			.then((r) => {
				if (!mounted) return;
				if (r.success) setTokenState('valid');
				else {
					setTokenError(r.error ?? '');
					setTokenState('invalid');
				}
			})
			.catch(() => mounted && setTokenState('invalid'));
		return () => {
			mounted = false;
		};
	}, [token]);

	const met = checks.filter((c) => c.ok(password)).length;
	const strongEnough = met >= 3;
	const matches = password !== '' && password === confirm;

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!strongEnough) return setError(t('tooWeak'));
		if (!matches) return setError(t('mismatch'));
		const fd = new FormData(e.currentTarget);
		if (token) fd.append('token', token);
		setBusy(true);
		setError('');
		try {
			const r = await newPasswordAction({}, fd);
			if (r.success) setDone(true);
			else if ('error' in r && r.error) setError(r.error);
		} catch {
			setError(t('failed'));
		} finally {
			setBusy(false);
		}
	}

	let body: React.ReactNode;
	if (done) {
		body = (
			<>
				<Alert tone="ok">{t('doneBody')}</Alert>
				<div className="sg-auth-actions">
					<Link className="sg-auth-btn" href="/auth/signin">
						{t('signIn')}
					</Link>
				</div>
			</>
		);
	} else if (tokenState === 'checking') {
		body = <p className="sg-auth-lead">{t('checking')}</p>;
	} else if (tokenState === 'invalid') {
		body = (
			<>
				<Alert tone="error">{tokenError || t('invalidBody')}</Alert>
				<div className="sg-auth-actions">
					<Link className="sg-auth-btn" href="/auth/forgot-password">
						{t('requestNew')}
					</Link>
					<Link className="sg-auth-btn sg-auth-btn-secondary" href="/auth/signin">
						{t('backToSignIn')}
					</Link>
				</div>
			</>
		);
	} else {
		body = (
			<form onSubmit={onSubmit} className="sg-auth-fields">
				<label className="sg-auth-field">
					<span>{t('newPassword')}</span>
					<span className="sg-auth-input-wrap">
						<input
							className="sg-auth-input"
							type={show ? 'text' : 'password'}
							id="password"
	name="newPassword"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete="new-password"
							required
							autoFocus
						/>
						<button type="button" className="sg-auth-eye" onClick={() => setShow((s) => !s)}>
							{show ? t('hide') : t('show')}
						</button>
					</span>
				</label>
				{password ? (
					<ul className="sg-auth-rules" aria-label={t('rulesLabel')}>
						{checks.map((c) => (
							<li key={c.id} data-ok={c.ok(password) ? '1' : undefined}>
								{c.label}
							</li>
						))}
					</ul>
				) : (
					<p className="sg-auth-hint">{t('rulesHint')}</p>
				)}
				<label className="sg-auth-field">
					<span>{t('confirmPassword')}</span>
					<input
						className="sg-auth-input"
						type={show ? 'text' : 'password'}
						id="confirmPassword"
	name="confirmPassword"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						autoComplete="new-password"
						required
					/>
				</label>
				{confirm && !matches ? <p className="sg-auth-hint sg-auth-hint-error">{t('mismatch')}</p> : null}
				{error ? <Alert tone="error">{error}</Alert> : null}
				<div className="sg-auth-actions">
					<button className="sg-auth-btn" type="submit" disabled={busy || !strongEnough || !matches}>
						{busy ? t('settingPassword') : t('setPassword')}
					</button>
					<Link className="sg-auth-btn sg-auth-btn-secondary" href="/auth/signin">
						{t('backToSignIn')}
					</Link>
				</div>
			</form>
		);
	}

	return (
		<section className="sg-auth-card" aria-labelledby="sg-auth-title">
			<h1 id="sg-auth-title" className="sg-auth-title">
				{done ? t('doneTitle') : tokenState === 'invalid' ? t('invalidTitle') : t('newTitle')}
			</h1>
			{!done && tokenState === 'valid' ? <p className="sg-auth-lead">{t('newBody')}</p> : null}
			{body}
		</section>
	);
}
