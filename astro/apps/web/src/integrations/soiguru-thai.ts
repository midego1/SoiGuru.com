/**
 * soiguru-thai — writes the Thai copy of every SoiGuru page under `/th/…` after the build.
 *
 * Every visible text on the SoiGuru screens that has a Thai version carries it in
 * `data-th` (the browser swaps it when a visitor picks ไทย). For `/th/` the swap happens
 * here instead, at build time, so Thai pages are real HTML that search engines index and
 * that paint in Thai before any script:
 *
 * - `<html lang="th" data-lang="th">`; the open-status script then speaks Thai.
 * - Each element whose only content is text and that has `data-th` gets the Thai text;
 *   the English text moves to `data-en`.
 * - Links and form actions to other SoiGuru pages point at their `/th/` twin.
 * - The canonical link and `og:url` name the Thai URL; the sitemap lists the Thai pages.
 *
 * A page is a SoiGuru page when it carries `data-path-en` (set by `SoiGuruLayout`).
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** Leaf elements with a `data-th` attribute and text-only content. */
const LEAF_RE = /<([a-z][a-z0-9]*)((?:\s[^>]*?)?)\sdata-th="([^"]*)"([^>]*)>([^<]*)<\/\1>/g;
const LINK_RE = /\s(href|action)="(\/[^"]*)"/g;

async function htmlFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
        else if (entry.name === 'index.html') out.push(full);
    }
    return out;
}

/** `/krabi/` → `/krabi`; `/` stays. */
const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);
const thPath = (path: string) => (path === '/' ? '/th/' : `/th${path}`);

/**
 * Thai version of one page's HTML.
 *
 * @param html - The English page
 * @param routes - Normalized paths of every SoiGuru page (their links are rewritten)
 * @param site - Site origin without trailing slash
 * @param path - This page's normalized path
 */
export function toThai(html: string, routes: Set<string>, site: string, path: string): string {
    return html
        .replace(/<html lang="en" data-lang="en"/, '<html lang="th" data-lang="th"')
        .replace(LEAF_RE, (whole, tag: string, before: string, th: string, after: string, text: string) =>
            th.trim() === '' ? whole : `<${tag}${before} data-th="${th}" data-en="${text.replace(/"/g, '&quot;')}"${after}>${th}</${tag}>`
        )
        .replace(LINK_RE, (whole, attr: string, url: string) => {
            const [pathAndQuery = '', hash = ''] = url.split('#');
            const [target = '', query] = pathAndQuery.split('?');
            if (!routes.has(normalize(target))) return whole;
            return ` ${attr}="${thPath(normalize(target))}${query !== undefined ? `?${query}` : ''}${hash ? `#${hash}` : ''}"`;
        })
        .replace(`<link rel="canonical" href="${site}${path === '/' ? '/' : path}"`, `<link rel="canonical" href="${site}${thPath(path)}"`)
        .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${site}${thPath(path)}"`);
}

/** The Astro integration. Add it after `@astrojs/sitemap` so the sitemap exists. */
export function soiguruThai(): AstroIntegration {
    let site = '';
    return {
        name: 'soiguru-thai',
        hooks: {
            'astro:config:done': ({ config }) => {
                site = (config.site ?? '').replace(/\/$/, '');
            },
            'astro:build:done': async ({ dir, logger }) => {
                const root = fileURLToPath(dir);
                const pages: { file: string; path: string; html: string }[] = [];
                for (const file of await htmlFiles(root)) {
                    if (file.startsWith(join(root, 'th'))) continue;
                    const html = await readFile(file, 'utf8');
                    const match = /<html[^>]*\sdata-path-en="([^"]*)"/.exec(html);
                    if (match) pages.push({ file, path: normalize(match[1] ?? '/'), html });
                }
                const routes = new Set(pages.map((p) => p.path));
                for (const page of pages) {
                    const target = join(root, thPath(page.path), 'index.html');
                    await mkdir(dirname(target), { recursive: true });
                    await writeFile(target, toThai(page.html, routes, site, page.path));
                }
                // Add the Thai pages that are indexable to the sitemap.
                const sitemapFile = join(root, 'sitemap-0.xml');
                try {
                    const xml = await readFile(sitemapFile, 'utf8');
                    const urls = pages
                        .filter((p) => !/<meta name="robots" content="noindex"/.test(p.html))
                        .map((p) => `<url><loc>${site}${thPath(p.path)}</loc></url>`)
                        .join('');
                    await writeFile(sitemapFile, xml.replace('</urlset>', `${urls}</urlset>`));
                } catch {
                    logger.warn('sitemap-0.xml not found; Thai pages are not in the sitemap');
                }
                logger.info(`wrote ${pages.length} Thai pages under /th/`);
            }
        }
    };
}
