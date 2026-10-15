import 'server-only';
import { auth } from '@/lib/auth';
import { getApprovedClaim, userIsAdmin } from './claims';
import { getCity, getCityListings } from './content';
import type { ListingClaim } from '@/lib/db/schema';
import type { City, Listing } from './types';

export type EditAccess =
	| { kind: 'signed-out' }
	| { kind: 'denied' }
	| { kind: 'ok'; userId: string; city: City; listing: Listing; claim?: ListingClaim; admin: boolean };

/**
 * Who may edit `city/slug` from the owner dashboard: the user with an
 * approved claim on it, or an admin. Pages render a sign-in prompt or
 * a 404 for the other cases; the server actions repeat this check.
 */
export async function getEditAccess(cityId: string, slug: string): Promise<EditAccess> {
	const session = await auth();
	const userId = session?.user?.id;
	if (!userId) return { kind: 'signed-out' };
	const city = await getCity(cityId);
	const listing = city ? (await getCityListings(city.id)).find((l) => l.slug === slug) : undefined;
	if (!city || !listing) return { kind: 'denied' };
	const [claim, admin] = await Promise.all([getApprovedClaim(userId, city.id, slug), userIsAdmin(userId)]);
	if (!claim && !admin) return { kind: 'denied' };
	return { kind: 'ok', userId, city, listing, claim, admin };
}
