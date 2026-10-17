/**
 * Photo gallery on the listing page: tapping the photo strip opens a full-screen,
 * swipeable gallery (`<dialog data-gallery>`, CSS scroll snap) at the tapped photo.
 * Arrow keys and the arrow buttons move between photos; Esc closes.
 * Openers and slides are looked up on each click, so photos added later (Google photos,
 * `places.ts`) open the gallery too.
 */

const dialog = document.querySelector<HTMLDialogElement>('dialog[data-gallery]');

if (dialog) {
    const track = dialog.querySelector<HTMLElement>('[data-gallery-track]')!;
    const slides = () => track.children;
    const pos = dialog.querySelector<HTMLElement>('[data-gallery-pos]')!;

    const current = () => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    const show = (i: number, smooth = true) => {
        const count = Math.max(slides().length, 1);
        const index = (i + count) % count;
        track.scrollTo({ left: index * track.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
        pos.textContent = `${index + 1} / ${count}`;
    };

    document.addEventListener('click', (event) => {
        const opener = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-gallery-open]') : null;
        if (!opener || slides().length === 0) return;
        dialog.showModal();
        show(Number(opener.dataset['galleryOpen'] ?? 0), false);
    });
    dialog.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const stepBtn = target?.closest<HTMLElement>('[data-gallery-step]');
        if (stepBtn) show(current() + Number(stepBtn.dataset['galleryStep']));
        else if (target?.closest('[data-gallery-close]')) dialog.close();
    });
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') show(current() + 1);
        if (event.key === 'ArrowLeft') show(current() - 1);
    });
    track.addEventListener('scroll', () => {
        pos.textContent = `${current() + 1} / ${slides().length}`;
    });
}
