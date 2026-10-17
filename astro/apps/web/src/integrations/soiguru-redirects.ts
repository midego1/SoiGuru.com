/**
 * soiguru-redirects — writes `dist/_redirects` after the build so the template's generic
 * pages (`/item/…`, `/category/…`, `/tag/…`, `/page/…`, `/directory`, …) send visitors
 * and search engines to the SoiGuru screens with a 301 instead of showing the old design.
 *
 * - `/item/<slug>` goes to the listing page `/<city>/<area>/<slug>`,
 *   found from the built SoiGuru pages (`data-path-en`, set by `SoiGuruLayout`).
 * - Everything else of the generic template goes to the landing page `/`.
 *
 * The generic routes stay in the code (AGENTS.md R11); Cloudflare Workers static assets
 * apply `_redirects` before serving files, so they are no longer reachable on the site.
 * The same prefixes are kept out of the sitemap in `astro.config.ts` (`GENERIC_PREFIXES`).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** Generic-template routes that have no SoiGuru page of their own: listing indexes go to `/`. */
export const GENERIC_PREFIXES = [
    '/item',
    '/category',
    '/categories',
    '/tag',
    '/tags',
    '/collection',
    '/collections',
    '/comparison',
    '/comparisons',
    '/directory',
    '/page',
    '/pages',
] as const;

async function htmlFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
        else if (entry.name === 'index.html') out.push(full);
    }
    return out;
}

/** The `_redirects` file for the given listing paths (`slug` → `/<city>/<area>/<slug>`). */
export function buildRedirects(listings: Map<string, string>): string {
    const lines: string[] = [];
    for (const [slug, path] of [...listings].sort(([a], [b]) => a.localeCompare(b))) {
        // Target the directory URL (`…/slug/`) that the static assets serve, so there is one hop.
        const target = `${path.replace(/\/+$/, '')}/`;
        // Two lines per listing keeps well under the 2,000 static redirects Workers allow; `.md` falls to `/`.
        lines.push(`/item/${slug} ${target} 301`, `/item/${slug}/ ${target} 301`);
    }
    for (const prefix of GENERIC_PREFIXES) {
        lines.push(`${prefix} / 301`, `${prefix}/ / 301`, `${prefix}/* / 301`);
    }
    // Crawlers often guess /sitemap.xml; the sitemap integration writes sitemap-index.xml.
    lines.push('/sitemap.xml /sitemap-index.xml 301');
    return `${lines.join('\n')}\n`;
}

/** The Astro integration. */
export function soiguruRedirects(): AstroIntegration {
    return {
        name: 'soiguru-redirects',
        hooks: {
            'astro:build:done': async ({ dir, logger }) => {
                const root = fileURLToPath(dir);
                const itemSlugs = new Set(
                    (await readdir(join(root, 'item'), { withFileTypes: true }).catch(() => []))
                        .filter((e) => e.isDirectory())
                        .map((e) => e.name)
                );
                const listings = new Map<string, string>();
                for (const file of await htmlFiles(root)) {
                    if (file.startsWith(join(root, 'th'))) continue;
                    const html = await readFile(file, 'utf8');
                    const path = /<html[^>]*\sdata-path-en="([^"]*)"/.exec(html)?.[1];
                    const segments = path?.split('/').filter(Boolean) ?? [];
                    const slug = segments.at(-1);
                    // Listing pages are `/<city>/<area>/<slug>` (or `/<city>/<slug>` without an area).
                    if (path && slug && segments.length >= 2 && itemSlugs.has(slug)) listings.set(slug, path);
                }
                await writeFile(join(root, '_redirects'), buildRedirects(listings));
                const missing = [...itemSlugs].filter((s) => !listings.has(s));
                if (missing.length) logger.info(`${missing.length} /item pages have no SoiGuru listing and go to /`);
                logger.info(`wrote _redirects (${listings.size} listings, ${GENERIC_PREFIXES.length} generic routes)`);
            },
        },
    };
}
