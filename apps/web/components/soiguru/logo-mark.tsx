/**
 * SoiGuru logo mark from the moodboard: a rounded sea-deep tile with a white
 * karst (limestone peak) silhouette and a sun-coloured water line. Pure SVG,
 * no client script, safe in server and client components.
 */
export function SoiGuruMark({
	size = 34,
	className,
	title
}: {
	size?: number;
	className?: string;
	/** Accessible name. Omit when the wordmark "SoiGuru" sits next to the mark. */
	title?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 34 34"
			className={className}
			role={title ? 'img' : undefined}
			aria-hidden={title ? undefined : true}
			aria-label={title}
			focusable="false"
		>
			<rect width="34" height="34" rx="9" fill="#064a50" />
			<path d="M6 25 L12 12 L16 19 L20 9 L28 25 Z" fill="#ffffff" />
			<path d="M6 27 H28" stroke="#f2a33a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
		</svg>
	);
}

/**
 * Larger karst scene for the admin sign-in panel: layered limestone peaks in
 * sea tones over a calm sea, with the sun line. Decorative.
 */
export function SoiGuruKarstScene({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 320 200" className={className} aria-hidden="true" focusable="false">
			<circle cx="236" cy="62" r="22" fill="#f2a33a" opacity="0.9" />
			<path d="M0 150 L38 96 L62 128 L96 58 L128 120 L150 92 L182 150 Z" fill="#0a6b73" />
			<path d="M120 150 L168 70 L196 112 L226 44 L268 124 L292 100 L320 150 Z" fill="#5fc9cf" opacity="0.55" />
			<path d="M40 150 L82 104 L104 132 L140 84 L176 150 Z" fill="#e2f1f2" opacity="0.9" />
			<rect x="0" y="150" width="320" height="50" fill="#0a6b73" opacity="0.55" />
			<path d="M24 166 H296" stroke="#f2a33a" strokeWidth="3" strokeLinecap="round" />
			<path d="M60 180 H140 M176 180 H260" stroke="#e2f1f2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
		</svg>
	);
}
