/**
 * Google Places photos for a listing without photos of its own (spec 056). The page renders
 * the drawn category picture in `[data-places-photos]`; this asks the owner app for up to three
 * photos and, when there are any, swaps the picture for them (each opens the full-screen
 * gallery, `gallery.ts`) with the author credit Google
 * requires ("Photo: <author> on Google"). Any failure keeps the drawing; nothing is shown.
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
    btn.setAttribute('aria-label', index === 0 ? 'Open photos' : `Open photo ${index + 1}`);
    btn.append(photoImg(photo, '', index === 0));
    fig.append(btn, credit(photo));
    return fig;
}

/** The same photo as a gallery slide (`<dialog data-gallery>`). */
function gallerySlide(photo: PlacesPhoto, name: string, index: number): HTMLElement {
    const fig = document.createElement('figure');
    // A larger version for the full-screen view (the photo route takes `w`, 200 to 1600).
    const big = { ...photo, url: `${photo.url}${photo.url.includes('?') ? '&' : '?'}w=1600` };
    // No size hints here: the gallery fits the photo to the screen (`object-fit: contain`).
    fig.append(photoImg(big, `${name}, photo ${index + 1}`, false, false), credit(photo));
    return fig;
}

async function loadPhotos(grid: HTMLElement): Promise<void> {
    const api = grid.dataset['placesPhotos'];
    if (!api) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch(api, { signal: ctrl.signal, credentials: 'omit' });
        if (!res.ok) return;
        const body = (await res.json()) as { photos?: PlacesPhoto[] };
        const photos = (body.photos ?? [])
            .filter((p) => typeof p.url === 'string' && (p.url.startsWith('/api/places/') || p.url.startsWith('https://')))
            .slice(0, 3);
        if (photos.length === 0) return;
        const name = grid.dataset['placesName'] ?? '';
        // Swap only once the first photo has loaded, so a broken photo never replaces the drawing.
        const figures = photos.map((p, i) => photoFigure(p, name, i));
        const first = figures[0]!.querySelector('img')!;
        await new Promise<void>((resolve, reject) => {
            first.addEventListener('load', () => resolve(), { once: true });
            first.addEventListener('error', () => reject(new Error('photo')), { once: true });
        });
        grid.classList.remove('sg-pgrid-art');
        grid.dataset['count'] = String(figures.length);
        grid.replaceChildren(...figures);
        const dialog = document.querySelector<HTMLDialogElement>('dialog[data-gallery]');
        dialog?.querySelector('[data-gallery-track]')?.replaceChildren(...photos.map((p, i) => gallerySlide(p, name, i)));
        const pos = dialog?.querySelector('[data-gallery-pos]');
        if (pos) pos.textContent = `1 / ${photos.length}`;
        if (photos.length < 2) dialog?.querySelectorAll('[data-gallery-step]').forEach((b) => b.remove());
    } catch {
        // Keep the drawing.
    } finally {
        clearTimeout(timer);
    }
}

for (const grid of document.querySelectorAll<HTMLElement>('[data-places-photos]')) void loadPhotos(grid);
