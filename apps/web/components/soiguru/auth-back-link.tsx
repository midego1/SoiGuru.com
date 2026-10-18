'use client';

import { useSearchParams } from 'next/navigation';

/**
 * "Back to SoiGuru" on the sign-in screens (spec 058): back to the public page the visitor
 * came from (the `to` of `callbackUrl=/return?to=…` or of `?to=`) when it is on one of the
 * public sites, else the public site's home.
 */
export function AuthBackLink({ sites, fallback, label }: { sites: string[]; fallback: string; label: string }) {
	const params = useSearchParams();
	let href = fallback;
	const candidates = [params.get('to')];
	const cb = params.get('callbackUrl') ?? params.get('redirect');
	if (cb) {
		try {
			candidates.push(new URL(cb, 'https://x.invalid').searchParams.get('to'));
		} catch {
			// ignore
		}
	}
	for (const raw of candidates) {
		if (!raw) continue;
		try {
			const url = new URL(raw);
			if (sites.includes(url.origin)) {
				href = url.toString();
				break;
			}
		} catch {
			// ignore
		}
	}
	return (
		<a className="sg-auth-back" href={href}>
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
				<path
					d="M15 18l-6-6 6-6"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<span>{label}</span>
		</a>
	);
}
