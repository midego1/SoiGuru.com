import { NextRequest, NextResponse } from 'next/server';
import { photoUri, verifyPhoto } from '@/lib/services/google-places.service';

/**
 * GET /api/places/photo?name=places/…/photos/…&sig=…&w=800 — redirects to Google's
 * short-lived URL for a photo listed by /api/places/photos/{slug} (spec 056). The signature
 * limits it to photos this server listed; nothing is stored.
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
	return NextResponse.redirect(uri, { status: 302, headers: { 'Cache-Control': 'private, max-age=300' } });
}
