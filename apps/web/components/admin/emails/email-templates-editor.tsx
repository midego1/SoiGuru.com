'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
	DEFAULT_RENDER_OPTIONS,
	fillPlaceholders,
	renderTemplate,
	unknownPlaceholders
} from '@/lib/soiguru/emails/render';
import {
	EMAIL_TEMPLATE_IDS,
	EMAIL_TEMPLATES,
	sampleValues,
	type EmailTemplateContent,
	type EmailTemplateId
} from '@/lib/soiguru/emails/templates';
import './email-editor.css';

/**
 * Admin editor for SoiGuru's transactional emails (spec 073), at `/admin/emails`.
 *
 * Left: the templates, marked Edited or Default. Middle: subject, preview text and HTML body,
 * with the template's placeholders as chips that insert at the cursor. Right: the email as it
 * will arrive, rendered with sample values in a sandboxed iframe (desktop, phone or plain
 * text). Save stores an override; Reset deletes it; Test sends the current draft to the
 * signed-in admin.
 */

type Override = EmailTemplateContent & { updatedAt?: string | null };
type Status = { tone: 'ok' | 'error' | 'info'; text: string } | null;
type View = 'desktop' | 'phone' | 'text';

function defaults(id: EmailTemplateId): EmailTemplateContent {
	const d = EMAIL_TEMPLATES[id];
	return { subject: d.subject, preheader: d.preheader, bodyHtml: d.bodyHtml };
}

function same(a: EmailTemplateContent, b: EmailTemplateContent): boolean {
	return a.subject === b.subject && a.preheader === b.preheader && a.bodyHtml === b.bodyHtml;
}

export function EmailTemplatesEditor() {
	const t = useTranslations('admin.EMAIL_TEMPLATES');
	const [overrides, setOverrides] = useState<Partial<Record<EmailTemplateId, Override>>>({});
	const [drafts, setDrafts] = useState<Partial<Record<EmailTemplateId, EmailTemplateContent>>>({});
	const [selected, setSelected] = useState<EmailTemplateId>(EMAIL_TEMPLATE_IDS[0]);
	const [view, setView] = useState<View>('desktop');
	const [status, setStatus] = useState<Status>(null);
	const [busy, setBusy] = useState<'save' | 'reset' | 'test' | null>(null);
	const [origin, setOrigin] = useState('');
	const bodyRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		setOrigin(window.location.origin);
		let alive = true;
		fetch('/api/admin/email-templates', { cache: 'no-store' })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((data: { overrides?: Array<Override & { id: EmailTemplateId }> }) => {
				if (!alive) return;
				const map: Partial<Record<EmailTemplateId, Override>> = {};
				for (const o of data.overrides ?? []) map[o.id] = o;
				setOverrides(map);
			})
			.catch(() => alive && setStatus({ tone: 'error', text: t('LOAD_FAILED') }));
		return () => {
			alive = false;
		};
	}, [t]);

	const def = EMAIL_TEMPLATES[selected];
	const saved: EmailTemplateContent = overrides[selected] ?? defaults(selected);
	const draft: EmailTemplateContent = drafts[selected] ?? saved;
	const dirty = !same(draft, saved);

	const update = useCallback(
		(patch: Partial<EmailTemplateContent>) => {
			setDrafts((d) => ({ ...d, [selected]: { ...(d[selected] ?? saved), ...patch } }));
			setStatus(null);
		},
		[selected, saved]
	);

	const rendered = useMemo(
		() =>
			renderTemplate(selected, draft, sampleValues(selected), {
				...DEFAULT_RENDER_OPTIONS,
				// Show the logo from this deployment, so the preview works before the PNG is live.
				logoUrl: origin ? `${origin}/brand/email-logo-horizontal-88.png` : DEFAULT_RENDER_OPTIONS.logoUrl
			}),
		[selected, draft, origin]
	);

	const unknown = unknownPlaceholders(
		draft,
		def.placeholders.map((p) => p.key)
	);

	function insertPlaceholder(key: string) {
		const el = bodyRef.current;
		const token = `{{${key}}}`;
		if (!el) return update({ bodyHtml: draft.bodyHtml + token });
		const start = el.selectionStart ?? draft.bodyHtml.length;
		const end = el.selectionEnd ?? start;
		const next = draft.bodyHtml.slice(0, start) + token + draft.bodyHtml.slice(end);
		update({ bodyHtml: next });
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(start + token.length, start + token.length);
		});
	}

	async function save() {
		setBusy('save');
		setStatus(null);
		try {
			const res = await fetch(`/api/admin/email-templates/${selected}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.success) throw new Error(data.error || String(res.status));
			setOverrides((o) => ({ ...o, [selected]: data.override }));
			setDrafts((d) => {
				const next = { ...d };
				delete next[selected];
				return next;
			});
			setStatus({ tone: 'ok', text: t('SAVED') });
		} catch (error) {
			setStatus({
				tone: 'error',
				text: t('SAVE_FAILED', { error: error instanceof Error ? error.message : '' })
			});
		} finally {
			setBusy(null);
		}
	}

	async function reset() {
		if (!window.confirm(t('RESET_CONFIRM'))) return;
		setBusy('reset');
		setStatus(null);
		try {
			if (overrides[selected]) {
				const res = await fetch(`/api/admin/email-templates/${selected}`, { method: 'DELETE' });
				const data = await res.json().catch(() => ({}));
				if (!res.ok || !data.success) throw new Error(data.error || String(res.status));
			}
			setOverrides((o) => {
				const next = { ...o };
				delete next[selected];
				return next;
			});
			setDrafts((d) => {
				const next = { ...d };
				delete next[selected];
				return next;
			});
			setStatus({ tone: 'ok', text: t('RESET_DONE') });
		} catch (error) {
			setStatus({
				tone: 'error',
				text: t('SAVE_FAILED', { error: error instanceof Error ? error.message : '' })
			});
		} finally {
			setBusy(null);
		}
	}

	async function sendTest() {
		setBusy('test');
		setStatus(null);
		try {
			const res = await fetch(`/api/admin/email-templates/${selected}/test`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.success) throw new Error(data.error || String(res.status));
			setStatus({ tone: 'ok', text: t('TEST_SENT', { email: data.to }) });
		} catch (error) {
			setStatus({
				tone: 'error',
				text: t('TEST_FAILED', { error: error instanceof Error ? error.message : '' })
			});
		} finally {
			setBusy(null);
		}
	}

	const savedAt = overrides[selected]?.updatedAt;

	return (
		<div className="sg-mail">
			<header className="sg-mail-head">
				<h1 className="sg-mail-title">{t('TITLE')}</h1>
				<p className="sg-mail-lead">{t('LEAD')}</p>
			</header>

			<div className="sg-mail-grid">
				<nav className="sg-mail-list" aria-label={t('LIST_LABEL')}>
					{EMAIL_TEMPLATE_IDS.map((id) => {
						const item = EMAIL_TEMPLATES[id];
						const edited = Boolean(overrides[id]);
						const unsaved = Boolean(drafts[id] && !same(drafts[id]!, overrides[id] ?? defaults(id)));
						return (
							<button
								key={id}
								type="button"
								className="sg-mail-item"
								aria-current={id === selected ? 'true' : undefined}
								onClick={() => {
									setSelected(id);
									setStatus(null);
								}}
							>
								<span className="sg-mail-item-name">{item.name}</span>
								<span className="sg-mail-item-desc">{item.description}</span>
								<span className="sg-mail-badges">
									<span className={`sg-mail-badge${edited ? ' sg-mail-badge-edited' : ''}`}>
										{edited ? t('EDITED') : t('DEFAULT')}
									</span>
									{unsaved ? (
										<span className="sg-mail-badge sg-mail-badge-unsaved">{t('UNSAVED')}</span>
									) : null}
								</span>
							</button>
						);
					})}
				</nav>

				<section className="sg-mail-editor" aria-labelledby="sg-mail-editor-title">
					<h2 id="sg-mail-editor-title" className="sg-mail-h2">
						{def.name}
					</h2>
					<p className="sg-mail-muted">{def.description}</p>

					<label className="sg-mail-field">
						<span>{t('SUBJECT')}</span>
						<input
							className="sg-mail-input"
							value={draft.subject}
							maxLength={200}
							onChange={(e) => update({ subject: e.target.value })}
						/>
					</label>
					<label className="sg-mail-field">
						<span>{t('PREHEADER')}</span>
						<input
							className="sg-mail-input"
							value={draft.preheader}
							maxLength={300}
							onChange={(e) => update({ preheader: e.target.value })}
						/>
						<small className="sg-mail-muted">{t('PREHEADER_HINT')}</small>
					</label>
					<label className="sg-mail-field">
						<span>{t('BODY')}</span>
						<textarea
							ref={bodyRef}
							className="sg-mail-input sg-mail-code"
							value={draft.bodyHtml}
							rows={16}
							spellCheck={false}
							onChange={(e) => update({ bodyHtml: e.target.value })}
						/>
						<small className="sg-mail-muted">{t('BODY_HINT')}</small>
					</label>

					<div className="sg-mail-field">
						<span>{t('PLACEHOLDERS')}</span>
						<div className="sg-mail-chips">
							{def.placeholders.map((p) => (
								<button
									key={p.key}
									type="button"
									className="sg-mail-chip"
									title={`${p.description} (${p.sample})`}
									onClick={() => insertPlaceholder(p.key)}
								>
									{`{{${p.key}}}`}
								</button>
							))}
						</div>
						<small className="sg-mail-muted">{t('PLACEHOLDERS_HINT')}</small>
						<ul className="sg-mail-ph-list">
							{def.placeholders.map((p) => (
								<li key={p.key}>
									<code>{`{{${p.key}}}`}</code> {p.description}
								</li>
							))}
						</ul>
					</div>

					{unknown.length ? (
						<p className="sg-mail-status sg-mail-status-error" role="alert">
							{t('UNKNOWN', { list: unknown.map((k) => `{{${k}}}`).join(', ') })}
						</p>
					) : null}
					{status ? (
						<p
							className={`sg-mail-status sg-mail-status-${status.tone}`}
							role={status.tone === 'error' ? 'alert' : 'status'}
						>
							{status.text}
						</p>
					) : null}

					<div className="sg-mail-actions">
						<button type="button" className="sg-mail-btn" onClick={save} disabled={!dirty || busy !== null}>
							{busy === 'save' ? t('SAVING') : t('SAVE')}
						</button>
						<button
							type="button"
							className="sg-mail-btn sg-mail-btn-secondary"
							onClick={sendTest}
							disabled={busy !== null}
						>
							{busy === 'test' ? t('TESTING') : t('TEST')}
						</button>
						<button
							type="button"
							className="sg-mail-btn sg-mail-btn-ghost"
							onClick={reset}
							disabled={busy !== null || (!overrides[selected] && !dirty)}
						>
							{t('RESET')}
						</button>
					</div>
					{savedAt ? (
						<p className="sg-mail-muted">{t('LAST_SAVED', { date: new Date(savedAt).toLocaleString() })}</p>
					) : null}
				</section>

				<section className="sg-mail-preview" aria-labelledby="sg-mail-preview-title">
					<div className="sg-mail-preview-head">
						<h2 id="sg-mail-preview-title" className="sg-mail-h2">
							{t('PREVIEW')}
						</h2>
						<div className="sg-mail-seg" role="group" aria-label={t('PREVIEW')}>
							{(['desktop', 'phone', 'text'] as View[]).map((v) => (
								<button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
									{v === 'desktop' ? t('DESKTOP') : v === 'phone' ? t('PHONE') : t('PLAIN_TEXT')}
								</button>
							))}
						</div>
					</div>
					<div className="sg-mail-inbox">
						<div className="sg-mail-inbox-subject">
							<strong>{rendered.subject}</strong>
						</div>
						<div className="sg-mail-inbox-pre">
							{fillPlaceholders(draft.preheader, sampleValues(selected), false)}
						</div>
					</div>
					{view === 'text' ? (
						<pre className="sg-mail-text">{rendered.text}</pre>
					) : (
						<div className={`sg-mail-frame-wrap${view === 'phone' ? ' sg-mail-frame-phone' : ''}`}>
							<iframe
								title={t('PREVIEW')}
								className="sg-mail-frame"
								sandbox=""
								srcDoc={rendered.html}
								referrerPolicy="no-referrer"
							/>
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
