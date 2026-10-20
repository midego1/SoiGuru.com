/**
 * Google photos on listing cards (spec 059 of the owner app): a card without a photo of its own
 * (`[data-places-card="<slug>"]` on `.sg-tcard-photo`) shows its drawing until it scrolls near
 * the screen; then the cards in view are asked for together (`/api/places/cards?slugs=…`, up to
 * 12 per call, through this site's Worker) and each photo that loads fades in over the drawing
 * at 480px wide, with the author credit Google requires. No photo, an error or the owner app's
 * daily budget keeps the drawing.
 */
import { sizedUrl } from './places';

interface CardPhoto {
    url: string;
    author?: string;
}

const BATCH = 12;
const pending = new Map<string, HTMLElement[]>();
let timer: number | undefined;

function show(box: HTMLElement, photo: CardPhoto): void {
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.className = 'sg-tcard-gphoto';
    img.addEventListener(
        'load',
        () => {
            box.classList.add('has-gphoto');
            const credit = document.createElement('small');
            credit.className = 'sg-tcard-credit';
            credit.textContent = `Photo: ${photo.author ?? 'Google user'} on Google`;
            box.append(img, credit);
        },
        { once: true }
    );
    img.src = sizedUrl(photo.url, 480);
}

async function flush(): Promise<void> {
    timer = undefined;
    const slugs = [...pending.keys()].slice(0, BATCH);
    if (slugs.length === 0) return;
    const boxes = slugs.map((s) => [s, pending.get(s) ?? []] as const);
    for (const s of slugs) pending.delete(s);
    if (pending.size) timer = window.setTimeout(() => void flush(), 0);
    try {
        const res = await fetch(`/api/places/cards?slugs=${slugs.map(encodeURIComponent).join(',')}`, {
            credentials: 'same-origin'
        });
        if (!res.ok) return;
        const body = (await res.json()) as { photos?: Record<string, CardPhoto | null> };
        for (const [slug, els] of boxes) {
            const photo = body.photos?.[slug];
            if (!photo || typeof photo.url !== 'string' || !photo.url.includes('/api/places/')) continue;
            for (const el of els) show(el, photo);
        }
    } catch {
        // Keep the drawings.
    }
}

const seen = new WeakSet<Element>();
const observer = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting || seen.has(entry.target)) continue;
            seen.add(entry.target);
            observer.unobserve(entry.target);
            const el = entry.target as HTMLElement;
            const slug = el.dataset['placesCard'];
            if (!slug) continue;
            pending.set(slug, [...(pending.get(slug) ?? []), el]);
        }
        if (pending.size && timer === undefined) timer = window.setTimeout(() => void flush(), 60);
    },
    { rootMargin: '300px 0px' }
);

// Only when the site turns card photos on (`card_photos: true` in works.yml, `body[data-card-photos]`).
if (document.body.dataset['cardPhotos'] === '1') {
    for (const el of document.querySelectorAll<HTMLElement>('[data-places-card]')) observer.observe(el);
}
