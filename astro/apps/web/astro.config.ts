import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { everWorksIntegration } from '@ever-works/astro-integration';
import { getPluginRunner, getContent } from './src/lib/content';
import { soiguruThai } from './src/integrations/soiguru-thai';
import { soiguruRedirects, GENERIC_PREFIXES } from './src/integrations/soiguru-redirects';

/**
 * Astro Configuration
 *
 * ISR mode (default): static output with Vercel adapter for on-demand page regeneration.
 * Static mode (ENABLE_ISR=false): pure static output, no server runtime.
 *
 * Preact for interactive islands (compat: true enables react → preact aliasing for shadcn).
 * Tailwind v4 via Vite plugin (not @astrojs/tailwind which is v3-only).
 * Sitemap for SEO.
 * Ever Works integration for plugin build lifecycle hooks (Pagefind, etc.).
 */

const isISR = process.env['ENABLE_ISR'] !== 'false';

export default defineConfig({
	// In Astro 6, output: 'static' is the default and supports per-page opt-out
	// via `export const prerender = false`. The Vercel adapter enables ISR
	// for prerendered pages automatically.
	// Set ENABLE_ISR=false to skip the Vercel adapter entirely (pure static).
	output: 'static',

	// Vercel adapter enables ISR for prerendered pages
	...(isISR ? { adapter: vercel() } : {}),

	// Site URL for sitemap, canonical and hreflang links (SITE_URL overrides, e.g. for previews)
	site: process.env.SITE_URL || 'https://soiguru.com',

	integrations: [
		// Preact for lightweight interactive islands
		// compat: true aliases react → preact/compat so shadcn/ui components work as-is
		preact({ compat: true }),

		// Auto-generate sitemap.xml (city search pages are noindex, so they stay out, and the
		// generic template routes redirect to SoiGuru pages, so they stay out too)
		sitemap({
			filter: (page) => {
				const path = new URL(page).pathname;
				if (/\/(search|saved)\/?$/.test(path)) return false;
				return !GENERIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
			},
		}),

		// SoiGuru: Thai copies of every SoiGuru page under /th/ (after the sitemap, which it extends)
		soiguruThai(),

		// SoiGuru: 301s from the generic template routes (/item, /category, /tag, …) to SoiGuru pages
		soiguruRedirects(),

		// Ever Works plugin build hooks (onBeforeBuild, onAfterBuild)
		// + webhook endpoint injection when ISR is enabled
		everWorksIntegration({
			getRunner: () => getPluginRunner(),
			getContent: () => getContent(),
			sync: {
				isr: isISR,
				webhook: isISR && !!process.env['WEBHOOK_SECRET'],
				webhookSecret: process.env['WEBHOOK_SECRET'],
			},
		}),
	],

	// Vite configuration
	vite: {
		plugins: [
			// Tailwind CSS v4 via Vite plugin
			tailwindcss(),
		],
		// Optimize dependency pre-bundling
		optimizeDeps: {
			include: ['preact', 'yaml'],
		},
		// Bundle workspace packages through Vite instead of Node's ESM resolver
		// so extensionless TypeScript imports resolve correctly during SSR.
		// Externalize isomorphic-git to avoid Vite module runner timeout on Windows
		// (Vite 7.3.x bug — deep dependency chain resolution exceeds 60s timeout).
		ssr: {
			noExternal: [/^@ever-works\//],
			external: ['isomorphic-git'],
		},
	},
});
