/**
 * soiguru-minimal Worker: serves the static Astro build and, on `/api/places/*`, passes the
 * Google Places photos of the owner app (spec 056 of the Next app) through soiguru.com itself.
 * Same-origin means no CORS and nothing for ad or privacy blockers to stop on a second domain.
 *
 * - `/api/places/photos/<slug>` → the owner app's photo list, with each photo link rewritten
 *   to `/api/places/photo?…` on this site.
 * - `/api/places/photo?name=…&sig=…` → the image bytes from the owner app.
 *
 * Nothing is stored (Google's terms): browsers may keep an answer for 5 minutes.
 */

interface AssetsBinding {
    fetch(request: Request): Promise<Response>;
}

interface Env {
    ASSETS: AssetsBinding;
    /** Owner app origin; default https://owner.soiguru.com */
    OWNER_ORIGIN?: string;
}

interface PlacesPhoto {
    url: string;
    [key: string]: unknown;
}

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });

async function photoList(slug: string, owner: string): Promise<Response> {
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) return json({ photos: [] }, 400);
    const res = await fetch(`${owner}/api/places/photos/${slug}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return json({ photos: [] }, res.status === 404 ? 404 : 502);
    const body = (await res.json()) as { photos?: PlacesPhoto[] };
    const photos = (body.photos ?? []).flatMap((p) => {
        try {
            const u = new URL(p.url);
            return u.pathname === '/api/places/photo' ? [{ ...p, url: `/api/places/photo${u.search}` }] : [];
        } catch {
            return [];
        }
    });
    return json({ photos });
}

async function photo(search: string, owner: string): Promise<Response> {
    const res = await fetch(`${owner}/api/places/photo${search}`);
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return new Response('Not found', { status: 404 });
    return new Response(res.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' } });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const owner = (env.OWNER_ORIGIN ?? 'https://owner.soiguru.com').replace(/\/$/, '');
        try {
            if (url.pathname.startsWith('/api/places/photos/')) return await photoList(url.pathname.slice('/api/places/photos/'.length), owner);
            if (url.pathname === '/api/places/photo') return await photo(url.search, owner);
        } catch {
            return json({ photos: [] }, 502);
        }
        return env.ASSETS.fetch(request);
    },
};
