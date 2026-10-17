# 057 — Only the public site is indexed (SoiGuru)

Status: implemented

## Problem

The owner/admin app runs on owner.soiguru.com and on the server alias soiguru.midego.net.
It served `robots.txt` allowing every crawler, `index, follow` pages and a full sitemap, so
search engines and AI crawlers could index the dashboard copies of the directory next to the
public site, soiguru.com (a separate Astro frontend on Cloudflare).

## Behaviour

`lib/seo/indexing.ts` decides per request host:

- The canonical host (`NEXT_PUBLIC_CANONICAL_URL`, else the app URL, `www.` ignored) is indexable.
- Any other host, and any `owner.` or `admin.` subdomain, is not.
- `SEARCH_INDEXING=on|off` overrides the host check.

On a non-indexable host:

- `robots.txt` is `User-agent: * / Disallow: /` with no sitemap (search and AI crawlers).
- `sitemap.xml` is empty.
- Every page routed through `proxy.ts` carries `X-Robots-Tag: noindex, nofollow`.

Generic template deployments, reached on their own canonical host, are unchanged.

## Acceptance

- `curl https://owner.soiguru.com/robots.txt` → `Disallow: /`, no `Sitemap:` line.
- `curl -I https://owner.soiguru.com/` → `x-robots-tag: noindex, nofollow`.
- `https://owner.soiguru.com/sitemap.xml` has no `<url>` entries.
