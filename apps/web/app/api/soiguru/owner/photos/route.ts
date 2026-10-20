import { NextRequest, NextResponse } from 'next/server';
import { saveListingFields } from '@/lib/soiguru/claims';
import { getEditAccess } from '@/lib/soiguru/owner-access';
import { MAX_PHOTOS, writePhoto, deletePhotoFile } from '@/lib/soiguru/photos';

/**
 * POST /api/soiguru/owner/photos — an owner adds photos to their listing (spec 061).
 * Multipart form: `city`, `listing`, one or more `photo` files (already resized by the browser).
 * Only the owner with an approved claim, or an admin. Each file is checked by its signature and
 * size, written to the content repo, and the listing's `images` gets the new URLs in one commit.
 * Response: `{ images }` or `{ error }` (`signed-out`, `denied`, `too-many`, `not-an-image`, `too-large`).
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
	// Same-site only. Compare hosts: behind the proxy `nextUrl.origin` is the container's address.
	const origin = request.headers.get('origin');
	const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
	if (origin && URL.canParse(origin) && new URL(origin).host !== host)
		return NextResponse.json({ error: 'denied' }, { status: 403 });
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return NextResponse.json({ error: 'bad-request' }, { status: 400 });
	}
	const city = String(form.get('city') ?? '').slice(0, 40);
	const slug = String(form.get('listing') ?? '').slice(0, 120);
	const access = await getEditAccess(city, slug);
	if (access.kind === 'signed-out') return NextResponse.json({ error: 'signed-out' }, { status: 401 });
	if (access.kind === 'denied') return NextResponse.json({ error: 'denied' }, { status: 403 });

	const files = form
		.getAll('photo')
		.filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f);
	const current = access.listing.images;
	if (files.length === 0) return NextResponse.json({ images: current });
	if (current.length + files.length > MAX_PHOTOS) return NextResponse.json({ error: 'too-many' }, { status: 400 });

	const added: string[] = [];
	try {
		for (const f of files) added.push(await writePhoto(slug, new Uint8Array(await f.arrayBuffer())));
	} catch (error) {
		for (const url of added) await deletePhotoFile(slug, url);
		const code =
			error instanceof Error && ['too-large', 'not-an-image'].includes(error.message) ? error.message : 'failed';
		return NextResponse.json({ error: code }, { status: 400 });
	}
	const images = [...current, ...added];
	try {
		await saveListingFields(slug, { images }, `Owner photos: ${city}/${slug} (+${added.length})`);
	} catch {
		for (const url of added) await deletePhotoFile(slug, url);
		return NextResponse.json({ error: 'failed' }, { status: 500 });
	}
	return NextResponse.json({ images });
}
