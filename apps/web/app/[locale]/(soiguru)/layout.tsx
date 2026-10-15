import { IBM_Plex_Sans, IBM_Plex_Sans_Thai } from 'next/font/google';
import './soiguru.css';

/**
 * Shell for the SoiGuru public screens (city landing, CityHome,
 * CategoryResults, ListingPage). The template header and footer are hidden on
 * these routes by `ConditionalLayout`; this wrapper carries the design tokens,
 * the IBM Plex Sans + Plex Sans Thai pair and the 640px phone column.
 */

const plexSans = IBM_Plex_Sans({
	subsets: ['latin', 'latin-ext'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-plex-sans',
	display: 'swap'
});

const plexThai = IBM_Plex_Sans_Thai({
	subsets: ['thai'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-plex-thai',
	display: 'swap',
	preload: false
});

export default function SoiGuruLayout({ children }: { children: React.ReactNode }) {
	return <div className={`tkg-root ${plexSans.variable} ${plexThai.variable}`}>{children}</div>;
}
