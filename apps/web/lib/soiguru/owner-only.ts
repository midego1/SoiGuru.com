/**
 * owner.soiguru.com serves accounts, the owner dashboard and the admin only (2026-10-23).
 * The template's directory pages (home, categories, items, tags, blog, …) and the earlier
 * SoiGuru city pages still exist in this app, but visitors have no business seeing them on
 * the owner host: they looked like a second, different website. `ownerAppRedirect` decides,
 * from the path alone, where such a request goes on the public site. Pure (no `server-only`,
 * no Node APIs) so the edge proxy can use it.
 *
 * Kept on this host: `/owner/*`, `/<city>/claim`, `/auth/*`, `/admin/*`, `/client/*`,
 * `/dashboard/*`, `/return`, `/api/*` and Next internals. The root goes to `/owner`.
 * City pages (`/krabi`, `/krabi/ao-nang/<slug>`) keep their path on the public site, which has
 * the same URL scheme; the legal pages map to the site's `/privacy` and `/terms`; everything
 * else lands on the site root. Set `SOIGURU_OWNER_APP_ONLY=false` to switch the redirects off.
 */

const KEPT_PREFIXES = ['/owner', '/auth', '/admin', '/client', '/dashboard', '/return', '/api', '/_next'];

const SITE_PATHS: Record<string, string> = {
	'/privacy-policy': '/privacy',
	'/terms-of-service': '/terms',
	'/cookies': '/privacy',
	'/saved': '/',
	'/cities': '/'
};

const CITY_PATH = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}\/?$/;
const TEMPLATE_ROOTS = new Set([
	'about', 'blog', 'categories', 'collections', 'comparisons', 'docs', 'faq', 'favorites', 'help', 'integration',
	'items', 'map', 'newsletter', 'pages', 'pricing', 'sponsor', 'static-md', 'submit', 'surveys', 'tags', 'cities',
	'saved', 'privacy-policy', 'terms-of-service', 'cookies'
]);

export type OwnerAppRoute = { kind: 'keep' } | { kind: 'internal'; path: string } | { kind: 'site'; url: string };

/**
 * Where a page request on the owner host goes. `locales` are the app's locale prefixes
 * (`/th/krabi` is handled like `/krabi`, and an internal target keeps the prefix).
 */
export function ownerAppRoute(pathname: string, locales: readonly string[], publicSite: string): OwnerAppRoute {
	let localePrefix = '';
	let path = pathname.replace(/\/{2,}/g, '/');
	const first = path.split('/')[1] ?? '';
	if (first && locales.includes(first)) {
		localePrefix = `/${first}`;
		path = path.slice(localePrefix.length) || '/';
	}
	if (path === '/') return { kind: 'internal', path: `${localePrefix}/owner` };
	if (KEPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return { kind: 'keep' };
	if (/^\/[a-z0-9-]+\/claim\/?$/.test(path)) return { kind: 'keep' };

	const site = publicSite.replace(/\/+$/, '');
	const bare = path.replace(/\/+$/, '') || '/';
	if (bare in SITE_PATHS) return { kind: 'site', url: `${site}${SITE_PATHS[bare]}` };
	const root = bare.split('/')[1] ?? '';
	// A city page of the earlier SoiGuru pages in this app: the public site has the same path.
	if (!TEMPLATE_ROOTS.has(root) && CITY_PATH.test(bare)) return { kind: 'site', url: `${site}${bare}` };
	return { kind: 'site', url: `${site}/` };
}

/** The switch, read once: redirects are on unless `SOIGURU_OWNER_APP_ONLY=false`. */
export const OWNER_APP_ONLY = process.env.SOIGURU_OWNER_APP_ONLY !== 'false';

/** The public site's origin (`PUBLIC_SITE_ORIGINS`, first entry), read here so the edge proxy needs no `server-only` import. */
export const PUBLIC_SITE_ORIGIN = (process.env.PUBLIC_SITE_ORIGINS || 'https://soiguru.com').split(',')[0].trim().replace(/\/+$/, '') || 'https://soiguru.com';

/**
 * True when the request host is the public site itself (soiguru.com, with or without www):
 * there the template pages are the site and nothing redirects. Any other host (owner.,
 * admin., a server alias, localhost) is treated as the owner app.
 */
export function isPublicSiteHost(host: string | null | undefined, publicSite = PUBLIC_SITE_ORIGIN): boolean {
	if (!host) return false;
	const bare = (h: string) => h.toLowerCase().split(',')[0]!.trim().replace(/:\d+$/, '').replace(/^www\./, '');
	try {
		return bare(host) === bare(new URL(publicSite).host);
	} catch {
		return false;
	}
}
