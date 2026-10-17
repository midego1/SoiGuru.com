/**
 * Google Places photos for a listing without photos of its own (spec 056). The page renders
 * the drawn category picture in `[data-places-photos]`; this asks the owner app for up to three
 * photos and, when there are any, swaps the picture for them with the author credit Google
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

function photoFigure(photo: PlacesPhoto, name: string, index: number): HTMLElement {
    const fig = document.createElement('figure');
    fig.className = 'sg-pphoto';
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = `${name}, photo ${index + 1}`;
    img.loading = index === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    if (photo.width && photo.height) {
        img.width = photo.width;
        img.height = photo.height;
    }
    fig.append(img);
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
    fig.append(cap);
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
    } catch {
        // Keep the drawing.
    } finally {
        clearTimeout(timer);
    }
}

for (const grid of document.querySelectorAll<HTMLElement>('[data-places-photos]')) void loadPhotos(grid);
