import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCityListings } from '@/lib/soiguru/content';
import { isClaimPhotoKind, putClaimPhoto } from '@/lib/soiguru/claim-photos';

/**
 * POST /api/soiguru/claim/photos — a claimant stores one photo of a kind (spec 064).
 * Multipart form: `city`, `listing`, `kind` (`front` | `inside` | `menu`), `photo` (already
 * resized by the browser). Signed-in users only; the listing must exist. A photo of the same
 * kind replaces the earlier one. Response: `{ id }` or `{ error }` (`signed-out`, `bad-request`,
 * `not-found`, `not-an-image`, `too-large`, `failed`).
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
	const origin = request.headers.get('origin');
	const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
	if (origin && URL.canParse(origin) && new URL(origin).host !== host)
		return NextResponse.json({ error: 'denied' }, { status: 403 });
	const session = await auth();
	const userId = session?.user?.id;
	if (!userId) return NextResponse.json({ error: 'signed-out' }, { status: 401 });
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return NextResponse.json({ error: 'bad-request' }, { status: 400 });
	}
	const city = String(form.get('city') ?? '').slice(0, 40);
	const slug = String(form.get('listing') ?? '').slice(0, 120);
	const kind = String(form.get('kind') ?? '');
	const photo = form.get('photo');
	if (!isClaimPhotoKind(kind) || typeof photo !== 'object' || photo === null || !('arrayBuffer' in photo))
		return NextResponse.json({ error: 'bad-request' }, { status: 400 });
	const listing = (await getCityListings(city)).find((l) => l.slug === slug);
	if (!listing) return NextResponse.json({ error: 'not-found' }, { status: 404 });
	try {
		const ref = await putClaimPhoto(userId, city, slug, kind, new Uint8Array(await (photo as File).arrayBuffer()));
		return NextResponse.json({ id: ref.id, kind: ref.kind });
	} catch (error) {
		const code =
			error instanceof Error && ['too-large', 'not-an-image'].includes(error.message) ? error.message : 'failed';
		return NextResponse.json({ error: code }, { status: code === 'failed' ? 500 : 400 });
	}
}
