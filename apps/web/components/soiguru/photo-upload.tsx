'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Owner photo upload (spec 061): pick one or more photos, the browser scales each to at most
 * 1600px and encodes it as WebP (JPEG where the browser cannot), then posts them to
 * `/api/soiguru/owner/photos`. Small files upload fast on a phone and stay small in the content repo.
 */

const MAX_SIDE = 1600;

async function shrink(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas');
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();
	const encode = (type: string, quality: number) =>
		new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
	const webp = await encode('image/webp', 0.82);
	if (webp && webp.type === 'image/webp') return webp;
	const jpeg = await encode('image/jpeg', 0.85);
	if (!jpeg) throw new Error('encode');
	return jpeg;
}

export function PhotoUpload({
	city,
	listing,
	left,
	labels
}: {
	city: string;
	listing: string;
	/** How many more photos fit */
	left: number;
	labels: {
		add: string;
		uploading: string;
		tooMany: string;
		notAnImage: string;
		tooLarge: string;
		failed: string;
		signedOut: string;
	};
}) {
	const input = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onPick(files: FileList | null) {
		if (!files || files.length === 0) return;
		setError(null);
		if (files.length > left) {
			setError(labels.tooMany);
			return;
		}
		setBusy(true);
		try {
			const form = new FormData();
			form.set('city', city);
			form.set('listing', listing);
			for (const f of Array.from(files)) {
				let blob: Blob;
				try {
					blob = await shrink(f);
				} catch {
					setError(labels.notAnImage);
					return;
				}
				form.append('photo', blob, blob.type === 'image/webp' ? 'photo.webp' : 'photo.jpg');
			}
			const res = await fetch('/api/soiguru/owner/photos', { method: 'POST', body: form });
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			if (!res.ok) {
				const map: Record<string, string> = {
					'too-many': labels.tooMany,
					'not-an-image': labels.notAnImage,
					'too-large': labels.tooLarge,
					'signed-out': labels.signedOut
				};
				setError(map[body.error ?? ''] ?? labels.failed);
				return;
			}
			router.refresh();
		} catch {
			setError(labels.failed);
		} finally {
			setBusy(false);
			if (input.current) input.current.value = '';
		}
	}

	return (
		<div className="sg-photo-upload">
			<input
				ref={input}
				type="file"
				accept="image/*"
				multiple
				hidden
				onChange={(e) => void onPick(e.currentTarget.files)}
			/>
			<button
				type="button"
				className="tkg-btn tkg-btn-block"
				disabled={busy || left <= 0}
				onClick={() => input.current?.click()}
			>
				{busy ? labels.uploading : labels.add}
			</button>
			{error ? (
				<p className="tkg-help" role="alert" style={{ color: 'var(--closed)', marginTop: 8 }}>
					{error}
				</p>
			) : null}
		</div>
	);
}
