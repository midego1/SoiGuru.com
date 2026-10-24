import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MagicLinkLanding } from '@/components/soiguru/magic-link-landing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: 'soiguru.account' });
	// A one-time personal link: never indexed.
	return { title: t('metaSignIn'), robots: { index: false, follow: false } };
}

/** Where an emailed sign-in link lands (spec 073). */
export default function MagicLinkPage() {
	return (
		<Suspense fallback={null}>
			<MagicLinkLanding />
		</Suspense>
	);
}
