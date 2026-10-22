import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readClaimPhoto } from '@/lib/soiguru/claim-photos';
import { userIsAdmin } from '@/lib/soiguru/claims';

/**
 * GET /api/soiguru/claim/photos/<id> — a claim photo (spec 064), for the claimant's own
 * preview and for admins on the review screen. Never cached by shared caches.
 */

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!/^[a-f0-9-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
	const session = await auth();
	const userId = session?.user?.id;
	if (!userId) return new NextResponse('Unauthorized', { status: 401 });
	const photo = await readClaimPhoto(id);
	if (!photo) return new NextResponse('Not found', { status: 404 });
	if (photo.userId !== userId && !(await userIsAdmin(userId))) return new NextResponse('Not found', { status: 404 });
	return new NextResponse(new Uint8Array(photo.bytes), {
		headers: { 'Content-Type': photo.contentType, 'Cache-Control': 'private, max-age=300' }
	});
}
