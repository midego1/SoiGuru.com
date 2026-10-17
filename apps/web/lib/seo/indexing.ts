import { getBaseUrl } from '@/lib/utils/url-cleaner';

/**
 * Whether search engines and AI crawlers may index this deployment, by host.
 *
 * Only the canonical origin is indexable (NEXT_PUBLIC_CANONICAL_URL, else the app URL).
 * A deployment reached on another host (an owner/admin subdomain such as
 * owner.soiguru.com, or a server alias such as soiguru.midego.net, while the public
 * site soiguru.com is a separate frontend) answers `noindex` with a closed robots.txt
 * and an empty sitemap, so only the public site shows up in search and AI answers.
 *
 * `SEARCH_INDEXING=on` or `off` overrides the host check for every host.
 */
export function isIndexableHost(host: string | null | undefined): boolean {
	const override = process.env.SEARCH_INDEXING?.trim().toLowerCase();
	if (override === 'on' || override === 'true') return true;
	if (override === 'off' || override === 'false') return false;
	if (!host) return false;
	// Owner and admin subdomains are dashboards, never the public site.
	if (/^(owner|admin)\./i.test(host.trim())) return false;
	let canonical: string;
	try {
		canonical = new URL(getBaseUrl()).host.toLowerCase();
	} catch {
		return false;
	}
	const bare = (h: string) => h.toLowerCase().split(',')[0]!.trim().replace(/^www\./, '');
	return bare(host) === bare(canonical);
}

/** The request's public host: the proxy's forwarded host, else Host. */
export function requestHost(headers: Headers): string | null {
	return headers.get('x-forwarded-host') ?? headers.get('host');
}
