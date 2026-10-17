/**
 * Saved places, kept on this device (`localStorage`, versioned key). No accounts on the
 * public site, so nothing leaves the phone. `[data-save="slug"]` toggles a place;
 * `[data-saved-list]` (the Saved tab) shows the saved cards of the city.
 */

const KEY = 'sg-saved-v1';

/** Saved listing slugs, newest first. Empty when storage is unavailable. */
export function savedSlugs(): string[] {
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
    } catch {
        return [];
    }
}

function write(slugs: string[]): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(slugs));
    } catch {
        // Private mode or storage full: the heart still toggles for this page.
    }
}

function render(): void {
    const saved = savedSlugs();
    const th = document.documentElement.dataset['lang'] === 'th';
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-save]')) {
        const on = saved.includes(btn.dataset['save'] ?? '');
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? (th ? 'บันทึกแล้ว' : 'Saved') : th ? 'บันทึก' : 'Save');
    }
    for (const list of document.querySelectorAll<HTMLElement>('[data-saved-list]')) {
        const cards = [...list.querySelectorAll<HTMLElement>('[data-listing]')];
        const bySlug = new Map(cards.map((c) => [c.dataset['listing'] ?? '', c]));
        let shown = 0;
        for (const c of cards) c.hidden = true;
        for (const slug of saved) {
            const card = bySlug.get(slug);
            if (!card) continue;
            card.hidden = false;
            list.append(card);
            shown += 1;
        }
        const empty = document.querySelector<HTMLElement>('[data-saved-empty]');
        if (empty) empty.hidden = shown > 0;
        const count = document.querySelector<HTMLElement>('[data-saved-count]');
        if (count) count.textContent = String(shown);
    }
}

document.addEventListener('click', (event) => {
    const btn = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-save]') : null;
    if (!btn) return;
    const slug = btn.dataset['save'] ?? '';
    const saved = savedSlugs();
    write(saved.includes(slug) ? saved.filter((s) => s !== slug) : [slug, ...saved]);
    render();
});
window.addEventListener('storage', (e) => {
    if (e.key === KEY) render();
});

render();
