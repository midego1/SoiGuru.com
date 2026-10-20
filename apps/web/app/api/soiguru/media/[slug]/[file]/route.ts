import { NextResponse } from 'next/server';
import { readPhoto } from '@/lib/soiguru/photos';

/**
 * GET /api/soiguru/media/{slug}/{file} — an owner's photo from the content repo (spec 061).
 * soiguru.com serves it as `/media/{slug}/{file}` through its Worker. File names are unique per
 * upload, so the response is cacheable for a year.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
	const { slug, file } = await params;
	const photo = await readPhoto(slug, file);
	if (!photo) return new NextResponse('Not found', { status: 404 });
	return new NextResponse(new Uint8Array(photo.bytes), {
		headers: {
			'Content-Type': photo.type,
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Cross-Origin-Resource-Policy': 'cross-origin'
		}
	});
}
