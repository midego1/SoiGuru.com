'use client';

import { useRef, useState } from 'react';
import { shrink } from './photo-upload';
import { EXAMPLES } from './photo-examples';

/**
 * The claim flow's photo step (spec 064): three slots, shop front (required), inside and
 * menu or services. Each slot shows a tip and an example drawing until the owner takes or
 * picks a photo; the browser shrinks it and posts it to `/api/soiguru/claim/photos`. Continue
 * opens once the shop front is in.
 */

export type SlotKind = 'front' | 'inside' | 'menu';

export interface SlotLabels {
	title: string;
	tip: string;
	tag: string;
}

export function ClaimPhotos({
	city,
	listing,
	initial,
	slots,
	labels,
	next,
	summary
}: {
	city: string;
	listing: string;
	/** Photo ids already stored, by slot */
	initial: Partial<Record<SlotKind, string>>;
	slots: Record<SlotKind, SlotLabels>;
	labels: {
		take: string;
		retake: string;
		uploading: string;
		notAnImage: string;
		tooLarge: string;
		failed: string;
		signedOut: string;
		needFront: string;
		continueLabel: string;
	};
	/** Where Continue goes */
	next: string;
	/** Bottom bar: listing name and area */
	summary: { title: string; sub: string };
}) {
	const [ids, setIds] = useState(initial);
	const [busy, setBusy] = useState<SlotKind | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [tick, setTick] = useState(0);
	const inputs = {
		front: useRef<HTMLInputElement>(null),
		inside: useRef<HTMLInputElement>(null),
		menu: useRef<HTMLInputElement>(null)
	};

	async function onPick(kind: SlotKind, files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		setError(null);
		setBusy(kind);
		try {
			let blob: Blob;
			try {
				blob = await shrink(file);
			} catch {
				setError(labels.notAnImage);
				return;
			}
			const form = new FormData();
			form.set('city', city);
			form.set('listing', listing);
			form.set('kind', kind);
			form.set('photo', blob, 'photo');
			const res = await fetch('/api/soiguru/claim/photos', { method: 'POST', body: form });
			const body = (await res.json()) as { id?: string; error?: string };
			if (!res.ok || !body.id) {
				const map: Record<string, string> = {
					'not-an-image': labels.notAnImage,
					'too-large': labels.tooLarge,
					'signed-out': labels.signedOut
				};
				setError(map[body.error ?? ''] ?? labels.failed);
				return;
			}
			setIds((prev) => ({ ...prev, [kind]: body.id }));
			setTick((t) => t + 1);
		} catch {
			setError(labels.failed);
		} finally {
			setBusy(null);
			const input = inputs[kind].current;
			if (input) input.value = '';
		}
	}

	const ready = Boolean(ids.front);

	return (
		<>
			<div className="sg-cp-slots">
				{(['front', 'inside', 'menu'] as SlotKind[]).map((kind) => {
					const Example = EXAMPLES[kind];
					const id = ids[kind];
					const slot = slots[kind];
					return (
						<section key={kind} className="sg-cp-slot" aria-labelledby={`cp-${kind}`}>
							<div className="sg-cp-pic">
								{id ? <img src={`/api/soiguru/claim/photos/${id}?v=${tick}`} alt="" /> : <Example />}
								<span className={`sg-cp-tag${id ? ' sg-cp-tag-done' : ''}`}>{id ? '✓' : slot.tag}</span>
							</div>
							<div className="sg-cp-text">
								<h2 id={`cp-${kind}`} className="tkg-heading" style={{ margin: 0 }}>
									{slot.title}
								</h2>
								<p className="tkg-help" style={{ margin: '4px 0 10px' }}>
									{slot.tip}
								</p>
								<input
									ref={inputs[kind]}
									type="file"
									accept="image/*"
									hidden
									onChange={(e) => void onPick(kind, e.currentTarget.files)}
								/>
								<button
									type="button"
									className={`tkg-btn tkg-btn-sm${id ? ' tkg-btn-secondary' : ''}`}
									disabled={busy !== null}
									onClick={() => inputs[kind].current?.click()}
								>
									{busy === kind ? labels.uploading : id ? labels.retake : labels.take}
								</button>
							</div>
						</section>
					);
				})}
			</div>
			{error ? (
				<p className="tkg-help tkg-pad" role="alert" style={{ color: 'var(--closed)', marginTop: 8 }}>
					{error}
				</p>
			) : null}
			<div className="tkg-bottombar">
				<div className="tkg-bb-info">
					<span className="tkg-strong">{summary.title}</span>
					<small>{ready ? summary.sub : labels.needFront}</small>
				</div>
				{ready ? (
					<a className="tkg-btn" href={next}>
						{labels.continueLabel}
						<svg
							className="tkg-i"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden="true"
						>
							<path d="m9 6 6 6-6 6" />
						</svg>
					</a>
				) : (
					<span className="tkg-btn" aria-disabled="true" style={{ opacity: 0.4 }}>
						{labels.continueLabel}
					</span>
				)}
			</div>
		</>
	);
}
