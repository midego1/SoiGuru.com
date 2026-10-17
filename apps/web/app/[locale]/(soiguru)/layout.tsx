import { soiguruFontVariables } from '@/lib/soiguru/fonts';
import './soiguru.css';

/**
 * Shell for the SoiGuru public screens (city landing, CityHome,
 * CategoryResults, ListingPage). The template header and footer are hidden on
 * these routes by `ConditionalLayout`; this wrapper carries the design tokens,
 * the IBM Plex Sans + Plex Sans Thai pair and the 640px phone column.
 * The font pair is declared once in `lib/soiguru/fonts.ts` and shared with the
 * root layout (spec 055).
 */
export default function SoiGuruLayout({ children }: { children: React.ReactNode }) {
	return <div className={`tkg-root ${soiguruFontVariables}`}>{children}</div>;
}
