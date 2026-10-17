/**
 * SoiGuru's machine-readable files for AI search and agents (GEO): `llms.txt`,
 * `llms-full.txt` and `items.json`, built from the SoiGuru data with the canonical
 * `/<city>/<area>/<slug>/` URLs, opening hours, area, address and contact channels.
 * The generic template versions stay as the fallback when there is no SoiGuru data.
 */
import { formatThaiPhone, priceBand } from './format';
import { hoursRows } from './hours';
import type { Listing, SoiGuruData } from './data';

/** Absolute canonical URL of a listing page (directory form, as the static assets serve it). */
export const listingUrl = (site: string, l: Listing): string => `${site}${l.url.replace(/\/?$/, '/')}`;

/** "Mon–Fri 10:00–21:00; Sat–Sun closed", or undefined without hours. */
export function hoursText(l: Listing): string | undefined {
    if (!l.hours) return undefined;
    return hoursRows(l.hours)
        .map((r) => `${r.label} ${r.allDay ? 'open 24 hours' : r.closed ? 'closed' : r.times.join(', ')}`)
        .join('; ');
}

const description = (data: SoiGuruData): string => {
    const cities = data.cities.map((c) => c.name).join(', ');
    return `${data.config.company_name} is a local directory for Thailand (${cities}): ${data.listings.length} places such as restaurants, massage, tours, scooter rental and shops, with opening hours, location, phone, LINE and WhatsApp, in English and Thai.`;
};

/** `/llms.txt`: what the site is, where the canonical pages and data are. */
export function soiguruLlms(data: SoiGuruData, site: string): string {
    const lines = [`# ${data.config.company_name}`, '', `> ${description(data)}`, ''];
    lines.push(
        'Canonical site: ' + site,
        'Listing pages: ' + `${site}/<city>/<area>/<place>/` + ' (English); Thai copies under ' + `${site}/th/…`,
        'Opening hours on each page are in local time (Asia/Bangkok). Places marked "Verified owner" are kept up to date by the business itself.',
        ''
    );
    lines.push('## Data', '');
    lines.push(`- [All places with hours and contacts (Markdown)](${site}/llms-full.txt)`);
    lines.push(`- [All places (JSON)](${site}/items.json)`);
    lines.push(`- [Sitemap](${site}/sitemap-index.xml)`, '');
    for (const city of data.cities) {
        const inCity = data.listings.filter((l) => l.city.id === city.id);
        lines.push(`## ${city.name}${city.name_th ? ` (${city.name_th})` : ''}`, '');
        lines.push(`- [${city.name}: every place](${site}/${city.id}/)`);
        for (const cat of data.categories) {
            const n = inCity.filter((l) => l.category?.id === cat.id).length;
            if (n > 0) lines.push(`- [${cat.name} in ${city.name}](${site}/${city.id}/${cat.id}/): ${n} ${n === 1 ? 'place' : 'places'}`);
        }
        for (const area of city.areas) {
            const n = inCity.filter((l) => l.area?.id === area.id).length;
            if (n > 0) lines.push(`- [Places in ${area.name}, ${city.name}](${site}/${city.id}/${area.id}/): ${n}`);
        }
        lines.push('');
    }
    lines.push('## Businesses', '', `Owners can claim their listing to update hours, photos and contact details: ${data.config['owner_url'] ?? site}`, '');
    return lines.join('\n');
}

/** `/llms-full.txt`: every place as a short Markdown block. */
export function soiguruLlmsFull(data: SoiGuruData, site: string): string {
    const lines = [`# ${data.config.company_name}: all places`, '', `> ${description(data)}`, '', `Canonical site: ${site}`, ''];
    const sorted = [...data.listings].sort(
        (a, b) => (a.category?.name ?? '').localeCompare(b.category?.name ?? '') || a.name.localeCompare(b.name)
    );
    for (const l of sorted) {
        lines.push(`## ${l.name}${l.name_th ? ` (${l.name_th})` : ''}`, '');
        const facts: [string, string | undefined][] = [
            ['Page', listingUrl(site, l)],
            ['Category', l.category?.name],
            ['Area', [l.area?.name, l.city.name].filter(Boolean).join(', ')],
            ['Address', l.address],
            ['Opening hours', hoursText(l) ?? 'not confirmed'],
            ['Phone', l.phone ? formatThaiPhone(l.phone) : undefined],
            ['LINE', l.line_id],
            ['WhatsApp', l.whatsapp],
            ['Price', l.price_band ? priceBand(l.price_band) : undefined],
            ['Rating', l.rating ? `${l.rating}${l.rating_count ? ` (${l.rating_count} reviews)` : ''}` : undefined],
            ['Location', l.geo ? `${l.geo.lat}, ${l.geo.lng}` : undefined],
            ['Verified owner', l.claimed ? 'yes' : undefined],
            ['Updated', l.updated_at?.slice(0, 10)]
        ];
        for (const [k, v] of facts) if (v) lines.push(`- ${k}: ${v}`);
        if (l.description) lines.push('', l.description);
        lines.push('');
    }
    return lines.join('\n');
}

/** `/items.json`: every place with its canonical URL and the facts an agent needs. */
export function soiguruItemsJson(data: SoiGuruData, site: string): unknown {
    return {
        site: { name: data.config.company_name, url: site, description: description(data) },
        generatedAt: new Date().toISOString(),
        count: data.listings.length,
        items: data.listings.map((l) => ({
            slug: l.slug,
            name: l.name,
            name_th: l.name_th,
            url: listingUrl(site, l),
            description: l.description,
            category: l.category?.name,
            area: l.area?.name,
            city: l.city.name,
            address: l.address,
            geo: l.geo,
            hours: hoursText(l),
            phone: l.phone,
            line: l.line_id,
            whatsapp: l.whatsapp,
            price: l.price_band ? priceBand(l.price_band) : undefined,
            rating: l.rating,
            verified_owner: l.claimed,
            updated_at: l.updated_at
        }))
    };
}
