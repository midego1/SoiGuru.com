import { redirect } from 'next/navigation';

import { routing } from '@/i18n/routing';
import { ownerAppRoute } from '@/lib/soiguru/owner-only';
import { PUBLIC_SITE } from '@/lib/soiguru/public-site';

export const dynamic = 'force-dynamic';

/**
 * Where a non-navigation request for a page that lives on the public site ends up (spec 058).
 * The proxy rewrites React Server Components fetches (a `<Link>` prefetch, a client-side
 * navigation) for such paths here instead of answering them with a cross-origin 302, which
 * the browser would follow into a CORS error. `redirect()` from a server component travels
 * inside the flight payload, and Next's router then performs the full navigation itself.
 * Only the path comes from the request; the target is always computed by `ownerAppRoute`,
 * so this cannot become an open redirect.
 */
export default async function SiteRedirectPage({ searchParams }: { searchParams: Promise<{ p?: string | string[] }> }) {
	const { p } = await searchParams;
	const path = typeof p === 'string' && p.startsWith('/') ? p : '/';
	const route = ownerAppRoute(path, routing.locales, PUBLIC_SITE);
	redirect(route.kind === 'site' ? route.url : route.kind === 'internal' ? route.path : '/owner');
}
