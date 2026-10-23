import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isPublicSiteHost, ownerAppRoute } from '../owner-only';

/**
 * Spec 058 — owner.soiguru.com serves accounts, owners and the admin only.
 *
 * Run with: `pnpm --filter @ever-works/web test:unit`
 */

const LOCALES = ['en', 'th', 'fr', 'es', 'de', 'ar', 'zh'];
const SITE = 'https://soiguru.com';

const ROUTES: Array<[string, ReturnType<typeof ownerAppRoute>]> = [
	['/', { kind: 'internal', path: '/owner' }],
	['/th', { kind: 'internal', path: '/th/owner' }],
	['/th/', { kind: 'internal', path: '/th/owner' }],
	['/owner', { kind: 'keep' }],
	['/owner/krabi/x/menu', { kind: 'keep' }],
	['/th/owner', { kind: 'keep' }],
	['/krabi/claim', { kind: 'keep' }],
	['/th/krabi/claim', { kind: 'keep' }],
	['/auth/signin', { kind: 'keep' }],
	['/admin', { kind: 'keep' }],
	['/admin/items', { kind: 'keep' }],
	['/client/settings', { kind: 'keep' }],
	['/dashboard', { kind: 'keep' }],
	['/return', { kind: 'keep' }],
	['/api/soiguru/me', { kind: 'keep' }],
	['/categories', { kind: 'site', url: `${SITE}/` }],
	['/items/foo', { kind: 'site', url: `${SITE}/` }],
	['/discover/1', { kind: 'site', url: `${SITE}/` }],
	['/map', { kind: 'site', url: `${SITE}/` }],
	['/blog/post', { kind: 'site', url: `${SITE}/` }],
	['/privacy-policy', { kind: 'site', url: `${SITE}/privacy/` }],
	['/th/terms-of-service', { kind: 'site', url: `${SITE}/terms/` }],
	['/krabi', { kind: 'site', url: `${SITE}/krabi/` }],
	['/krabi/', { kind: 'site', url: `${SITE}/krabi/` }],
	['/th/krabi', { kind: 'site', url: `${SITE}/krabi/` }],
	['/krabi/ao-nang', { kind: 'site', url: `${SITE}/krabi/ao-nang/` }],
	['/krabi/ao-nang/ao-nang-nail-studio', { kind: 'site', url: `${SITE}/krabi/ao-nang/ao-nang-nail-studio/` }],
	['/krabi/a/b/c', { kind: 'site', url: `${SITE}/` }],
	['/cities', { kind: 'site', url: `${SITE}/` }],
	['/saved', { kind: 'site', url: `${SITE}/` }],
	['/Weird%20Path', { kind: 'site', url: `${SITE}/` }]
];

describe('ownerAppRoute', () => {
	for (const [pathname, want] of ROUTES) {
		it(`${pathname} → ${JSON.stringify(want)}`, () => {
			assert.deepEqual(ownerAppRoute(pathname, LOCALES, SITE), want);
		});
	}

	it('tolerates a trailing slash on the public site origin', () => {
		assert.deepEqual(ownerAppRoute('/krabi', LOCALES, `${SITE}/`), { kind: 'site', url: `${SITE}/krabi/` });
	});
});

describe('isPublicSiteHost', () => {
	const HOSTS: Array<[string | null, boolean]> = [
		['soiguru.com', true],
		['www.soiguru.com', true],
		['SoiGuru.com:443', true],
		['owner.soiguru.com', false],
		['owner.soiguru.com, owner.soiguru.com', false],
		['localhost:3000', false],
		[null, false],
		['thekrabiguide-web:3000', false]
	];
	for (const [host, want] of HOSTS) {
		it(`${String(host)} → ${want}`, () => {
			assert.equal(isPublicSiteHost(host, SITE), want);
		});
	}
});
