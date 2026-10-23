/**
 * City cover photos (spec 066): one landscape photo per city from Unsplash, written into
 * `cities.yml` as `cover` (image URL, photographer, links) so the site never calls Unsplash
 * at build time and every deploy shows the same photo.
 *
 * Usage: `tsx scripts/city-covers.ts <path to cities.yml> [--force] [--city krabi]`
 * Needs `UNSPLASH_ACCESS_KEY`. Cities that already have a `cover` are kept unless `--force`.
 * The search is "<city name> Thailand", landscape, and the first result is taken; pin another
 * photo by hand with `--photo <unsplash photo id>` for one city.
 *
 * Unsplash's guidelines: hotlink the `urls.*` image (never re-host), credit the photographer
 * with a link back (with utm_source), and register a download when the photo is used.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import YAML from 'yaml';

const API = 'https://api.unsplash.com';
const UTM = 'utm_source=soiguru&utm_medium=referral';

interface Cover {
    url: string;
    thumb: string;
    author: string;
    author_url: string;
    photo_url: string;
    photo_id: string;
}

interface UnsplashPhoto {
    id: string;
    urls: { raw: string; regular: string; small: string };
    links: { html: string; download_location: string };
    user: { name: string; links: { html: string } };
}

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function unsplash<T>(path: string, key: string): Promise<T> {
    const res = await fetch(`${API}${path}`, {
        headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }
    });
    if (!res.ok) throw new Error(`Unsplash ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
}

async function pick(cityName: string, key: string, photoId?: string): Promise<UnsplashPhoto> {
    if (photoId) return unsplash<UnsplashPhoto>(`/photos/${encodeURIComponent(photoId)}`, key);
    const q = encodeURIComponent(`${cityName} Thailand`);
    const r = await unsplash<{ results: UnsplashPhoto[] }>(
        `/search/photos?query=${q}&orientation=landscape&per_page=5&content_filter=high`,
        key
    );
    const photo = r.results[0];
    if (!photo) throw new Error(`No Unsplash photo for ${cityName}`);
    return photo;
}

function toCover(p: UnsplashPhoto): Cover {
    // Sized by Unsplash's CDN: 1600px wide for the hero, 640px for cards; both JPEG, quality 75.
    const base = p.urls.raw.split('?')[0];
    return {
        url: `${base}?auto=format&fit=crop&w=1600&h=900&q=75`,
        thumb: `${base}?auto=format&fit=crop&w=640&h=360&q=70`,
        author: p.user.name,
        author_url: `${p.user.links.html}?${UTM}`,
        photo_url: `${p.links.html}?${UTM}`,
        photo_id: p.id
    };
}

async function main(): Promise<void> {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: city-covers.ts <cities.yml> [--force] [--city id] [--photo id]');
    const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
    if (!key) throw new Error('UNSPLASH_ACCESS_KEY is not set');
    const force = process.argv.includes('--force');
    const onlyCity = arg('--city');
    const photoId = arg('--photo');

    const doc = YAML.parseDocument(readFileSync(file, 'utf8'));
    const cities = doc.contents;
    if (!YAML.isSeq(cities)) throw new Error(`${file}: expected a list of cities`);

    let changed = 0;
    for (const item of cities.items) {
        if (!YAML.isMap(item)) continue;
        const id = String(item.get('id') ?? '');
        const name = String(item.get('name') ?? id);
        if (onlyCity && id !== onlyCity) continue;
        if (item.has('cover') && !force && !photoId) {
            console.log(`${id}: keeps its cover`);
            continue;
        }
        const photo = await pick(name, key, onlyCity === id ? photoId : undefined);
        const cover = toCover(photo);
        item.set('cover', doc.createNode(cover));
        // Unsplash asks for a download event when a photo is put to use.
        await unsplash(photo.links.download_location.replace(API, ''), key).catch(() => undefined);
        console.log(`${id}: ${cover.photo_url} by ${cover.author}`);
        changed++;
    }
    if (changed) writeFileSync(file, doc.toString({ lineWidth: 0 }));
    console.log(changed ? `${changed} cover(s) written to ${file}` : 'nothing to do');
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
