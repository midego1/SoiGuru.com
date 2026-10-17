import { IBM_Plex_Sans, IBM_Plex_Sans_Thai } from 'next/font/google';

/**
 * The SoiGuru type pair (spec 054 / 055): IBM Plex Sans for Latin and IBM Plex
 * Sans Thai for Thai, weights 400–700, `display: swap`. Declared once here so
 * the root layout (template chrome, admin, client dashboard) and the SoiGuru
 * screens share the same font files and the same CSS variables
 * (`--font-plex-sans`, `--font-plex-thai`).
 */
export const plexSans = IBM_Plex_Sans({
	subsets: ['latin', 'latin-ext'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-plex-sans',
	display: 'swap'
});

export const plexThai = IBM_Plex_Sans_Thai({
	subsets: ['thai'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-plex-thai',
	display: 'swap',
	preload: false
});

/** Class names that define both font variables on an element. */
export const soiguruFontVariables = `${plexSans.variable} ${plexThai.variable}`;
