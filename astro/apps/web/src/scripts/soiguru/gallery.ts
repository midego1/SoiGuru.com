/**
 * Photo gallery on the listing page: tapping the photo strip opens a full-screen,
 * swipeable gallery (`<dialog data-gallery>`, CSS scroll snap) at the tapped photo.
 * Arrow keys and the arrow buttons move between photos; Esc closes.
 */

const dialog = document.querySelector<HTMLDialogElement>('dialog[data-gallery]');

if (dialog) {
    const track = dialog.querySelector<HTMLElement>('[data-gallery-track]')!;
    const slides = [...track.children] as HTMLElement[];
    const pos = dialog.querySelector<HTMLElement>('[data-gallery-pos]')!;

    const current = () => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    const show = (i: number, smooth = true) => {
        const index = (i + slides.length) % slides.length;
        track.scrollTo({ left: index * track.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
        pos.textContent = `${index + 1} / ${slides.length}`;
    };

    for (const opener of document.querySelectorAll<HTMLElement>('[data-gallery-open]')) {
        opener.addEventListener('click', () => {
            dialog.showModal();
            show(Number(opener.dataset['galleryOpen'] ?? 0), false);
        });
    }
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
        pos.textContent = `${current() + 1} / ${slides.length}`;
    });
}
