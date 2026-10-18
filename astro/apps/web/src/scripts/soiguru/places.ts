/**
 * Google Places photos for a listing without photos of its own (spec 056). The page renders a
 * quiet placeholder grid in `[data-places-photos]` (the list request is preloaded in `<head>`);
 * this asks the owner app for up to three photos and, when there are any, fades them in
 * (800px for the big one, 480px for the small ones). Without photos, or after an error or 8 s,
 * the drawn category picture from the `<template>` takes the place. Each photo opens the
 * full-screen gallery (`gallery.ts`) and carries the author credit Google requires
 * ("Photo: <author> on Google").
 * The list and the images come from this site (`/api/places/*`, the Worker in `worker/index.ts`).
 */
interface PlacesPhoto {
    url: string;
    width?: number;
    height?: number;
    author?: string;
    authorUri?: string;
}

/** The author credit Google requires: "Photo: <author> on Google", linked to the author. */
function credit(photo: PlacesPhoto): HTMLElement {
    const cap = document.createElement('figcaption');
    cap.append('Photo: ');
    if (photo.author && photo.authorUri?.startsWith('https://')) {
        const a = document.createElement('a');
        a.href = photo.authorUri;
        a.target = '_blank';
        a.rel = 'noopener nofollow';
        a.textContent = photo.author;
        cap.append(a);
    } else {
        cap.append(photo.author ?? 'Google user');
    }
    cap.append(' on Google');
    return cap;
}

/** The photo route's URL at a given width (`w`, 200 to 1600). */
export function sizedUrl(url: string, w: number): string {
    return `${url}${url.includes('?') ? '&' : '?'}w=${w}`;
}

function photoImg(photo: PlacesPhoto, alt: string, eager: boolean, sized = true): HTMLImageElement {
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = alt;
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (sized && photo.width && photo.height) {
        img.width = photo.width;
        img.height = photo.height;
    }
    return img;
}

/** One photo in the grid: a button that opens the gallery at this photo, with the credit. */
function photoFigure(photo: PlacesPhoto, name: string, index: number): HTMLElement {
    const fig = document.createElement('figure');
    fig.className = 'sg-pphoto';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sg-photo-btn';
    btn.dataset['galleryOpen'] = String(index);
    btn.setAttribute('aria-label', index === 0 ? `Open photos of ${name}` : `Open photo ${index + 1} of ${name}`);
    // The big photo at 800px, the two small ones at 480px: less to download before they show.
    const img = photoImg({ ...photo, url: sizedUrl(photo.url, index === 0 ? 800 : 480) }, '', index === 0);
    if (index === 0) img.setAttribute('fetchpriority', 'high');
    btn.append(img);
    fig.append(btn, credit(photo));
    return fig;
}

/** The same photo as a gallery slide (`<dialog data-gallery>`). */
function gallerySlide(photo: PlacesPhoto, name: string, index: number): HTMLElement {
    const fig = document.createElement('figure');
    // A larger version for the full-screen view (the photo route takes `w`, 200 to 1600).
    const big = { ...photo, url: sizedUrl(photo.url, 1600) };
    // No size hints here: the gallery fits the photo to the screen (`object-fit: contain`).
    fig.append(photoImg(big, `${name}, photo ${index + 1}`, false, false), credit(photo));
    return fig;
}

async function loadPhotos(grid: HTMLElement): Promise<void> {
    const api = grid.dataset['placesPhotos'];
    if (!api) return;
    let loaded = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        // Same request as the page's `<link rel="preload" as="fetch">`, so it reuses that response.
        const res = await fetch(api, { signal: ctrl.signal, credentials: 'same-origin' });
        if (!res.ok) return;
        const body = (await res.json()) as { photos?: PlacesPhoto[] };
        const photos = (body.photos ?? [])
            .filter((p) => typeof p.url === 'string' && (p.url.startsWith('/api/places/') || p.url.startsWith('https://')))
            .slice(0, 3);
        if (photos.length === 0) return;
        loaded = true;
        const name = grid.dataset['placesName'] ?? '';
        // Swap only once the first photo has loaded, so a broken photo never replaces the drawing.
        const figures = photos.map((p, i) => photoFigure(p, name, i));
        const first = figures[0]!.querySelector('img')!;
        await new Promise<void>((resolve, reject) => {
            first.addEventListener('load', () => resolve(), { once: true });
            first.addEventListener('error', () => reject(new Error('photo')), { once: true });
            setTimeout(() => reject(new Error('timeout')), 8000);
        });
        grid.classList.remove('sg-pgrid-art', 'sg-pgrid-wait');
        grid.dataset['count'] = String(figures.length);
        grid.replaceChildren(...figures);
        const dialog = document.querySelector<HTMLDialogElement>('dialog[data-gallery]');
        dialog?.querySelector('[data-gallery-track]')?.replaceChildren(...photos.map((p, i) => gallerySlide(p, name, i)));
        const pos = dialog?.querySelector('[data-gallery-pos]');
        if (pos) pos.textContent = `1 / ${photos.length}`;
        if (photos.length < 2) dialog?.querySelectorAll('[data-gallery-step]').forEach((b) => b.remove());
    } catch {
        loaded = false;
    } finally {
        clearTimeout(timer);
        if (!loaded) showDrawing(grid);
        grid.removeAttribute('aria-busy');
    }
}

/** No photos (or an error): the drawn category scene from the `<template>`, as before. */
function showDrawing(grid: HTMLElement): void {
    const tpl = grid.querySelector<HTMLTemplateElement>('template[data-places-fallback]');
    if (!tpl) return;
    grid.classList.remove('sg-pgrid-wait');
    grid.classList.add('sg-pgrid-art');
    grid.dataset['count'] = '1';
    grid.replaceChildren(tpl.content.cloneNode(true));
}

for (const grid of document.querySelectorAll<HTMLElement>('[data-places-photos]')) void loadPhotos(grid);
