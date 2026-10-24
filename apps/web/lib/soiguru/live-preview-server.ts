import 'server-only';
import { getAmenities } from './content';
import { previewFromListing, type AmenityNames, type PreviewListing } from './live-preview';
import type { City, Listing } from './types';

/**
 * Server half of the edit pages' live preview (spec 074): the saved listing as plain preview
 * data, with amenity names from `amenities.yml` and the area name in the UI language.
 */

export async function getAmenityNames(): Promise<AmenityNames> {
	const all = await getAmenities();
	return Object.fromEntries([...all].map(([id, a]) => [id, { name: a.name, name_th: a.name_th }]));
}

export async function getPreviewBase(listing: Listing, city: City, thai: boolean): Promise<PreviewListing> {
	const area = city.areas.find((a) => a.id === listing.area);
	return previewFromListing(listing, {
		areaName: area ? (thai && area.name_th) || area.name : undefined,
		amenityNames: await getAmenityNames()
	});
}
