/**
 * Listing page title bar (spec 072): `[data-lpbar]` sits inside the sticky site header and
 * shows (`data-stuck`) once the page's h1 has scrolled up behind the header. The observer's
 * top margin is the header's height, re-measured when the header changes size (it is 61px
 * on phones, 65px from 720px).
 */
const bar = document.querySelector<HTMLElement>('[data-lpbar]');
const title = document.querySelector<HTMLElement>('.sg-lp-title');
const header = bar?.closest<HTMLElement>('.sg-sh');

if (bar && title && header && 'IntersectionObserver' in window) {
    let observer: IntersectionObserver | null = null;
    let height = -1;
    const watch = (): void => {
        const next = Math.round(header.getBoundingClientRect().height);
        if (next === height) return;
        height = next;
        observer?.disconnect();
        observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[entries.length - 1];
                if (!entry) return;
                // Out of view above the header: stuck. Below the screen (never at load) is not.
                bar.toggleAttribute('data-stuck', !entry.isIntersecting && entry.boundingClientRect.top < height);
            },
            { rootMargin: `-${height}px 0px 0px 0px`, threshold: 0 },
        );
        observer.observe(title);
    };
    watch();
    if ('ResizeObserver' in window) new ResizeObserver(watch).observe(header);
}
