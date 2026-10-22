/**
 * Example drawings for the three photos we ask an owner for (spec 064): the shop front, the
 * inside and the menu or services. Simple line art in the SoiGuru colours, so the claim step
 * shows what a good photo looks like before the owner takes one. Replaced by the owner's photo
 * once it is uploaded.
 */

import type { ReactNode } from 'react';

const sea = 'var(--sea)';
const ink = 'var(--ink-muted)';
const sun = 'var(--sun)';
const tint = 'var(--surface-200)';

function Frame({ children }: { children: ReactNode }) {
	return (
		<svg viewBox="0 0 160 120" role="img" aria-hidden="true" className="sg-cp-example">
			<rect x="0" y="0" width="160" height="120" rx="10" fill={tint} />
			{children}
		</svg>
	);
}

/** A shop seen straight on: sign, awning, door, window. */
export function ExampleFront() {
	return (
		<Frame>
			<rect x="26" y="34" width="108" height="66" fill="var(--surface)" stroke={ink} strokeWidth="2" />
			<rect x="26" y="22" width="108" height="16" rx="3" fill={sea} />
			<rect x="52" y="26" width="56" height="8" rx="2" fill="var(--on-sea)" opacity="0.85" />
			<path d="M22 46 L138 46 L132 56 L28 56 Z" fill={sun} />
			<rect x="38" y="60" width="34" height="30" fill={tint} stroke={ink} strokeWidth="2" />
			<rect x="88" y="60" width="26" height="40" rx="2" fill={tint} stroke={ink} strokeWidth="2" />
			<circle cx="109" cy="81" r="2" fill={ink} />
			<line x1="10" y1="100" x2="150" y2="100" stroke={ink} strokeWidth="2" />
		</Frame>
	);
}

/** Inside: a counter, two tables, a lamp. */
export function ExampleInside() {
	return (
		<Frame>
			<rect x="24" y="30" width="112" height="70" fill="var(--surface)" stroke={ink} strokeWidth="2" />
			<rect x="96" y="56" width="32" height="44" fill={sea} opacity="0.9" />
			<rect x="96" y="52" width="36" height="6" rx="2" fill={ink} />
			<rect x="34" y="70" width="26" height="4" rx="2" fill={ink} />
			<line x1="47" y1="74" x2="47" y2="100" stroke={ink} strokeWidth="2" />
			<rect x="62" y="78" width="22" height="4" rx="2" fill={ink} />
			<line x1="73" y1="82" x2="73" y2="100" stroke={ink} strokeWidth="2" />
			<line x1="56" y1="30" x2="56" y2="44" stroke={ink} strokeWidth="2" />
			<path d="M46 44 L66 44 L62 54 L50 54 Z" fill={sun} />
		</Frame>
	);
}

/** A menu board with a few lines and prices. */
export function ExampleMenu() {
	return (
		<Frame>
			<rect x="40" y="18" width="80" height="88" rx="4" fill="var(--surface)" stroke={ink} strokeWidth="2" />
			<rect x="52" y="26" width="56" height="8" rx="2" fill={sea} />
			{[44, 56, 68, 80, 92].map((y) => (
				<g key={y}>
					<rect x="50" y={y} width="36" height="4" rx="2" fill={ink} opacity="0.7" />
					<rect x="96" y={y} width="14" height="4" rx="2" fill={sun} />
				</g>
			))}
		</Frame>
	);
}

export const EXAMPLES = { front: ExampleFront, inside: ExampleInside, menu: ExampleMenu } as const;
