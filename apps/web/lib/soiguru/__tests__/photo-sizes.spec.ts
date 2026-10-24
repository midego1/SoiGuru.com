import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { copyName, encodeCopy, encodeMain, parseCopyName } from '../photo-sizes';

/**
 * Owner photo sizes (lib/soiguru/photo-sizes.ts, spec 067).
 *
 * Run with: `pnpm --filter @ever-works/web test:unit`
 */

const jpeg = (width: number, height: number) =>
	sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
		.jpeg()
		.toBuffer();

describe('copy names', () => {
	it('derives the copies of a WebP photo', () => {
		assert.equal(copyName('mvlsrtwr166b256ff7.webp', 800), 'mvlsrtwr166b256ff7-800.webp');
		assert.equal(copyName('mvlsrtwr166b256ff7.webp', 400), 'mvlsrtwr166b256ff7-400.webp');
	});

	it('has no copies for older JPEG or PNG photos', () => {
		assert.equal(copyName('mvlstlfzd8b6e061c1.jpg', 800), null);
		assert.equal(copyName('abcdef.png', 400), null);
	});

	it('parses copy names and refuses anything else', () => {
		assert.deepEqual(parseCopyName('mvlsrtwr166b256ff7-800.webp'), { id: 'mvlsrtwr166b256ff7', size: 800 });
		assert.deepEqual(parseCopyName('mvlsrtwr166b256ff7-400.webp'), { id: 'mvlsrtwr166b256ff7', size: 400 });
		assert.equal(parseCopyName('mvlsrtwr166b256ff7.webp'), null);
		assert.equal(parseCopyName('mvlsrtwr166b256ff7-600.webp'), null);
		assert.equal(parseCopyName('../x-800.webp'), null);
	});
});

describe('encoding', () => {
	it('makes the main photo a WebP of at most 1600px', async () => {
		const out = await sharp(await encodeMain(await jpeg(3000, 2000))).metadata();
		assert.equal(out.format, 'webp');
		assert.equal(out.width, 1600);
		assert.equal(out.height, 1067);
	});

	it('does not enlarge small photos', async () => {
		const out = await sharp(await encodeMain(await jpeg(900, 1600))).metadata();
		assert.equal(out.width, 900);
		assert.equal(out.height, 1600);
	});

	it('crops the copies to 800×600 and 400×300', async () => {
		const src = await jpeg(1200, 1600);
		const big = await sharp(await encodeCopy(src, 800)).metadata();
		const small = await sharp(await encodeCopy(src, 400)).metadata();
		assert.deepEqual([big.format, big.width, big.height], ['webp', 800, 600]);
		assert.deepEqual([small.format, small.width, small.height], ['webp', 400, 300]);
	});

	it('throws on bytes that are not an image', async () => {
		await assert.rejects(encodeMain(new Uint8Array([0xff, 0xd8, 0xff, 0, 1, 2, 3, 4, 5, 6, 7, 8])));
	});
});
