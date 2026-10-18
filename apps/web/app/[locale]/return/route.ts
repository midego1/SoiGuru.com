import { NextRequest, NextResponse } from 'next/server';
import { safePublicUrl } from '@/lib/soiguru/public-site';

/**
 * GET /return?to=<url> — back to the public site after signing in or creating an account
 * (spec 058). The sign-in form only accepts relative callback URLs, so soiguru.com sends
 * `callbackUrl=/return?to=https://soiguru.com/krabi/…`; this route then redirects to `to`
 * when it is on a public site origin, else to the public site's home.
 */
export function GET(request: NextRequest) {
	return NextResponse.redirect(safePublicUrl(request.nextUrl.searchParams.get('to')), 303);
}
