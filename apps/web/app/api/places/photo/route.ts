import { NextRequest, NextResponse } from 'next/server';
import { photoUri, verifyPhoto } from '@/lib/services/google-places.service';

/**
 * GET /api/places/photo?name=places/…/photos/…&sig=…&w=800 — the image of a photo listed by
 * /api/places/photos/{slug} (spec 056). The server fetches Google's short-lived photo URL and
 * passes the bytes through (browsers and networks that block or mishandle the Google image
 * host still get the photo); the browser may keep it for 5 minutes, the server stores nothing.
 * The signature limits it to photos this server listed. Falls back to a redirect when the
 * image cannot be fetched.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const name = searchParams.get('name') ?? '';
	const sig = searchParams.get('sig') ?? '';
	const w = Math.min(Math.max(Number(searchParams.get('w')) || 800, 200), 1600);
	if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(name) || !verifyPhoto(name, sig)) {
		return new NextResponse('Not found', { status: 404 });
	}
	const uri = await photoUri(name, w);
	if (!uri) return new NextResponse('Not found', { status: 404 });
	try {
		const img = await fetch(uri);
		const type = img.headers.get('content-type') ?? '';
		if (img.ok && img.body && type.startsWith('image/')) {
			return new NextResponse(img.body, {
				status: 200,
				headers: {
					'Content-Type': type,
					'Cache-Control': 'private, max-age=300',
					'Cross-Origin-Resource-Policy': 'cross-origin'
				}
			});
		}
	} catch (error) {
		console.error('[places/photo]', error instanceof Error ? error.message : error);
	}
	return NextResponse.redirect(uri, { status: 302, headers: { 'Cache-Control': 'private, max-age=300' } });
}
