/**
 * CategoryResults behaviour: filters (open now, area, sort, search text, the Filters
 * sheet), List/Map mode, "Show N closed now", "Show more" at 20, and the OpenStreetMap
 * map (Leaflet, imported on demand so the list paints first) with "Search this area" and
 * a swipeable sheet for the tapped pin. State lives in the URL query, so results can be
 * shared: `?q=&area=&open=&sort=&view=&price=1,2&rating=4&line=1&wa=1&verified=1&am=wifi`.
 */

import { currentLang, locate, visitor } from './page';
import { localClock } from '../../lib/soiguru/hours';
import { distanceMetres } from '../../lib/soiguru/geo';
import type * as Leaflet from 'leaflet';

const PAGE_SIZE = 20;
const WIDE = '(min-width: 960px)';

interface Pin {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    url: string;
    directions: string;
}

/** Interface strings in both languages (the rest of the page swaps through `[data-th]`). */
const TEXT = {
    en: {
        openNow: (n: number) => `${n} open now`,
        ofTotal: (n: number, noun: string, where: string) => `of ${n} ${noun} in ${where}`,
        inArea: (n: number, noun: string) => `of ${n} ${noun} in this map area`,
        showMore: (n: number) => `Show more (${n})`,
        showClosed: (n: number) => `Show ${n} closed now`,
        showPlaces: (n: number) => (n === 1 ? 'Show 1 place' : `Show ${n} places`),
        allAreas: 'All areas',
        sheetPos: (i: number, n: number) => `${i} of ${n}`,
        noneOpen: 'Nothing here is open right now, so all places are shown. Check the hours before you go.'
    },
    th: {
        openNow: (n: number) => `เปิดอยู่ ${n} แห่ง`,
        ofTotal: (n: number, _noun: string, where: string) => `จาก ${n} แห่งใน${where}`,
        inArea: (n: number) => `จาก ${n} แห่งในบริเวณแผนที่นี้`,
        showMore: (n: number) => `ดูเพิ่ม (${n})`,
        showClosed: (n: number) => `ดูที่ปิดอยู่ ${n} แห่ง`,
        showPlaces: (n: number) => `ดู ${n} แห่ง`,
        allAreas: 'ทุกพื้นที่',
        sheetPos: (i: number, n: number) => `${i} จาก ${n}`,
        noneOpen: 'ตอนนี้ยังไม่มีที่ไหนเปิด จึงแสดงทั้งหมด โปรดดูเวลาเปิด-ปิดก่อนไป'
    }
};

/** Lower-cased query words; a plural "s" is dropped so "nails" finds "nail salons". */
function queryWords(q: string): string[] {
    return q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => (w.length > 3 && /[a-z]s$/.test(w) ? w.slice(0, -1) : w));
}

const root = document.querySelector<HTMLElement>('[data-results-root]');

if (root) {
    const list = root.querySelector<HTMLElement>('[data-results]')!;
    const cards = [...list.querySelectorAll<HTMLElement>('[data-listing]')];
    const openBtn = root.querySelector<HTMLButtonElement>('[data-filter-open]')!;
    const areaLabel = root.querySelector<HTMLElement>('[data-area-label]');
    const areaButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-area-set]')];
    const sortSelect = root.querySelector<HTMLSelectElement>('[data-filter-sort]')!;
    const sortLabel = root.querySelector<HTMLElement>('[data-sort-label]')!;
    const countOpen = root.querySelector<HTMLElement>('[data-count-open]')!;
    const countTotal = root.querySelector<HTMLElement>('[data-count-total]')!;
    const countShort = root.querySelector<HTMLElement>('[data-count-short]')!;
    const showMore = root.querySelector<HTMLButtonElement>('[data-show-more]')!;
    const showClosed = root.querySelector<HTMLButtonElement>('[data-show-closed]')!;
    const empty = root.querySelector<HTMLElement>('[data-results-empty]')!;
    const filterCount = root.querySelector<HTMLElement>('[data-filter-count]');
    const filtersChip = root.querySelector<HTMLElement>('[data-filters-chip]');
    const applyBtn = document.querySelector<HTMLButtonElement>('[data-f-apply]');
    const areaPill = root.querySelector<HTMLButtonElement>('[data-search-area]')!;
    const clearBounds = root.querySelector<HTMLButtonElement>('[data-clear-bounds]')!;
    const inlineSearch = root.querySelector<HTMLElement>('[data-inline-search]');
    // The search page's own bar, or the inline field on category and area pages.
    const qInput =
        root.querySelector<HTMLInputElement>('[data-filter-q]') ??
        (root.dataset['search'] === '1' ? document.querySelector<HTMLInputElement>('.sg-search-wrap input[name="q"]') : null);
    const noun = root.dataset['noun'] ?? 'places';
    const pins: Pin[] = JSON.parse(document.querySelector('[data-pins]')?.textContent ?? '[]');
    const t = () => TEXT[currentLang()];

    const params = new URLSearchParams(location.search);
    const csv = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);
    const state = {
        // "Open now" is on by default between 09:00 and 23:00 local time, off at night
        // (so the list is not empty at 02:00). An explicit `?open=` wins.
        open: params.has('open') ? params.get('open') === '1' : isDaytime(),
        area: params.get('area') ?? root.dataset['defaultArea'] ?? '',
        sort: params.get('sort') ?? 'rating',
        view: params.get('view') === 'map' ? 'map' : 'list',
        q: (params.get('q') ?? '').trim(),
        price: new Set(csv('price').map(Number)),
        rating: params.get('rating') === '4',
        line: params.get('line') === '1',
        wa: params.get('wa') === '1',
        verified: params.get('verified') === '1',
        amenities: new Set(csv('am')),
        bounds: null as Leaflet.LatLngBounds | null,
        closedShown: false,
        limit: PAGE_SIZE,
        selected: ''
    };

    function isDaytime(): boolean {
        const { minutes } = localClock(new Date(), document.body.dataset['tz'] || 'Asia/Bangkok');
        return minutes >= 9 * 60 && minutes < 23 * 60;
    }

    const writeUrl = () => {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.area && state.area !== (root.dataset['defaultArea'] ?? '')) p.set('area', state.area);
        if (state.open !== isDaytime()) p.set('open', state.open ? '1' : '0');
        if (state.sort !== 'rating') p.set('sort', state.sort);
        if (state.view === 'map') p.set('view', 'map');
        if (state.price.size) p.set('price', [...state.price].sort().join(','));
        if (state.rating) p.set('rating', '4');
        if (state.line) p.set('line', '1');
        if (state.wa) p.set('wa', '1');
        if (state.verified) p.set('verified', '1');
        if (state.amenities.size) p.set('am', [...state.amenities].join(','));
        const qs = p.toString();
        history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
    };

    const activeFilters = () =>
        state.price.size + Number(state.rating) + Number(state.line) + Number(state.wa) + Number(state.verified) + state.amenities.size;

    /** Everything but "open now": the pool the counts are taken from. */
    const matchesWith = (c: HTMLElement, s: typeof state) => {
        const words = queryWords(s.q);
        const amenities = (c.dataset['amenities'] ?? '').split(' ');
        const lat = Number(c.dataset['lat']);
        const lng = Number(c.dataset['lng']);
        return (
            (!s.area || c.dataset['area'] === s.area) &&
            words.every((w) => (c.dataset['search'] ?? '').includes(w)) &&
            (!s.price.size || s.price.has(Number(c.dataset['price']))) &&
            (!s.rating || Number(c.dataset['rating'] ?? 0) >= 4) &&
            (!s.line || c.dataset['line'] === '1') &&
            (!s.wa || c.dataset['wa'] === '1') &&
            (!s.verified || c.dataset['verified'] === '1') &&
            [...s.amenities].every((a) => amenities.includes(a)) &&
            (!s.bounds || (Number.isFinite(lat) && s.bounds.contains([lat, lng])))
        );
    };
    const matches = (c: HTMLElement) => matchesWith(c, state);
    const isOpen = (c: HTMLElement) => c.dataset['open'] === '1';

    const sorted = (items: HTMLElement[]) => {
        const by = state.sort;
        return [...items].sort((a, b) => {
            if (by === 'nearest' && visitor)
                return Number(a.dataset['metres'] ?? 9e9) - Number(b.dataset['metres'] ?? 9e9);
            if (by === 'updated')
                return Date.parse(b.dataset['updated'] ?? '') - Date.parse(a.dataset['updated'] ?? '') || 0;
            return Number(b.dataset['rating'] ?? 0) - Number(a.dataset['rating'] ?? 0);
        });
    };

    /** Cards currently shown (open ones, or all when "open now" is off). */
    let shownCards: HTMLElement[] = [];
    /** "Open now" was set by the visitor (link or chip), not by the time of day. */
    let openChosen = params.has('open');
    const noneOpenNote = root.querySelector<HTMLElement>('[data-none-open]');

    /** Apply filters, sort and paging to the rendered cards. */
    const render = () => {
        const pool = sorted(cards.filter(matches));
        const open = pool.filter(isOpen);
        const closed = pool.filter((c) => !isOpen(c));
        // Default "open now" with nothing open (a café list at 08:00): show everything with a
        // note instead of an empty page. When the visitor chose "open now", keep their choice.
        const noneOpen = state.open && !openChosen && open.length === 0 && closed.length > 0;
        if (noneOpen) state.closedShown = true;
        const visible = state.open && !state.closedShown ? open : pool;
        shownCards = state.open ? open : pool;
        // Re-order in the DOM: open first, then the rest (when shown).
        const ordered = state.open ? [...open, ...closed] : pool;
        for (const c of ordered) list.append(c);
        for (const c of cards) c.hidden = true;
        visible.slice(0, state.limit).forEach((c) => (c.hidden = false));

        const text = t();
        const areaBtn = areaButtons.find((b) => b.dataset['areaSet'] === state.area && state.area);
        const areaName = areaBtn
            ? (currentLang() === 'th' && areaBtn.dataset['areaNameTh']) || areaBtn.dataset['areaName'] || ''
            : '';
        const where = areaName || (root.dataset['where'] ?? '');
        countOpen.textContent = text.openNow(open.length);
        countTotal.textContent = state.bounds ? text.inArea(pool.length, noun) : text.ofTotal(pool.length, noun, where);
        countShort.textContent = text.openNow(open.length);
        empty.hidden = pool.length > 0 && visible.length > 0;
        showMore.hidden = visible.length <= state.limit;
        showMore.textContent = text.showMore(visible.length - state.limit);
        showClosed.hidden = !state.open || state.closedShown || closed.length === 0;
        showClosed.textContent = text.showClosed(closed.length);
        if (noneOpenNote) {
            noneOpenNote.hidden = !noneOpen;
            noneOpenNote.textContent = text.noneOpen;
        }
        clearBounds.hidden = !state.bounds;

        openBtn.setAttribute('aria-pressed', String(state.open));
        if (areaLabel) areaLabel.textContent = areaName || text.allAreas;
        for (const b of areaButtons) b.classList.toggle('tkg-chip-on', (b.dataset['areaSet'] ?? '') === state.area);
        sortLabel.textContent = sortSelect.selectedOptions[0]?.textContent ?? 'Top rated';
        root.dataset['view'] = state.view;
        for (const b of root.querySelectorAll<HTMLButtonElement>('.sg-view-seg [data-view-set]')) {
            const on = b.dataset['viewSet'] === state.view;
            b.classList.toggle('tkg-on', on);
            b.setAttribute('aria-pressed', String(on));
        }
        renderFilterSheet();
        updatePins(new Set(shownCards.map((c) => c.dataset['listing'] ?? '')));
    };

    // --- Filters sheet ------------------------------------------------------------
    const renderFilterSheet = () => {
        const n = activeFilters();
        if (filterCount) {
            filterCount.hidden = n === 0;
            filterCount.textContent = String(n);
        }
        filtersChip?.setAttribute('aria-pressed', String(n > 0));
        for (const b of document.querySelectorAll<HTMLButtonElement>('[data-f-price]'))
            b.setAttribute('aria-pressed', String(state.price.has(Number(b.dataset['fPrice']))));
        for (const b of document.querySelectorAll<HTMLButtonElement>('[data-f-toggle]')) {
            const key = b.dataset['fToggle'] as 'rating' | 'line' | 'wa' | 'verified';
            b.setAttribute('aria-pressed', String(state[key]));
        }
        for (const b of document.querySelectorAll<HTMLButtonElement>('[data-f-amenity]'))
            b.setAttribute('aria-pressed', String(state.amenities.has(b.dataset['fAmenity'] ?? '')));
        if (applyBtn) {
            const pool = cards.filter(matches);
            applyBtn.textContent = t().showPlaces(state.open ? pool.filter(isOpen).length : pool.length);
        }
    };

    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const price = target?.closest<HTMLElement>('[data-f-price]');
        const toggle = target?.closest<HTMLElement>('[data-f-toggle]');
        const amenity = target?.closest<HTMLElement>('[data-f-amenity]');
        const areaSet = target?.closest<HTMLElement>('[data-area-set]');
        if (price) {
            const p = Number(price.dataset['fPrice']);
            if (state.price.has(p)) state.price.delete(p);
            else state.price.add(p);
        } else if (toggle) {
            const key = toggle.dataset['fToggle'] as 'rating' | 'line' | 'wa' | 'verified';
            state[key] = !state[key];
        } else if (amenity) {
            const a = amenity.dataset['fAmenity'] ?? '';
            if (state.amenities.has(a)) state.amenities.delete(a);
            else state.amenities.add(a);
        } else if (target?.closest('[data-f-clear]')) {
            state.price.clear();
            state.amenities.clear();
            state.rating = state.line = state.wa = state.verified = false;
        } else if (areaSet) {
            state.area = areaSet.dataset['areaSet'] ?? '';
        } else return;
        state.limit = PAGE_SIZE;
        writeUrl();
        render();
    });

    // --- search text ----------------------------------------------------------------
    if (qInput) {
        if (!qInput.value) qInput.value = state.q;
        let timer = 0;
        qInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = window.setTimeout(() => {
                state.q = qInput.value.trim();
                state.limit = PAGE_SIZE;
                writeUrl();
                render();
            }, 120);
        });
        // On the search page the form would reload the same page: filter in place instead.
        qInput.form?.addEventListener('submit', (event) => {
            event.preventDefault();
            state.q = qInput.value.trim();
            writeUrl();
            render();
            qInput.blur();
        });
    }
    if (inlineSearch && state.q) inlineSearch.hidden = false;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-search-toggle]')) {
        btn.addEventListener('click', () => {
            if (!inlineSearch) return;
            inlineSearch.hidden = !inlineSearch.hidden;
            btn.setAttribute('aria-expanded', String(!inlineSearch.hidden));
            if (!inlineSearch.hidden) qInput?.focus();
        });
    }

    // --- map --------------------------------------------------------------------
    const mapEl = root.querySelector<HTMLElement>('[data-map]')!;
    let L: typeof Leaflet | null = null;
    let map: Leaflet.Map | null = null;
    const markers = new Map<string, Leaflet.Marker>();
    let youMarker: Leaflet.Marker | null = null;
    /** True while the map moves because of code (fitBounds), not the visitor. */
    let programmatic = false;

    const pinIcon = (selected: boolean) =>
        L!.divIcon({
            className: 'sg-pin',
            iconSize: selected ? [30, 40] : [24, 32],
            iconAnchor: selected ? [15, 38] : [12, 30],
            html: `<svg viewBox="-12 -24 24 32" aria-hidden="true"><path class="${selected ? 'tkg-m-pin-on' : 'tkg-m-pin'}" d="M0-18a9 9 0 0 1 9 9c0 6-9 15-9 15S-9-3-9-9a9 9 0 0 1 9-9Z"/><circle class="tkg-m-pin-dot" cx="0" cy="-9" r="3"/></svg>`
        });

    const wide = () => window.matchMedia(WIDE).matches;
    const interactive = () => state.view === 'map' || wide();

    const setInteractive = () => {
        if (!map) return;
        const on = interactive();
        for (const handler of [
            map.dragging,
            map.touchZoom,
            map.scrollWheelZoom,
            map.doubleClickZoom,
            map.boxZoom,
            map.keyboard
        ]) {
            if (on) handler.enable();
            else handler.disable();
        }
        map.invalidateSize();
    };

    function updatePins(visible: Set<string>): void {
        if (!map || !L) return;
        const shown: Leaflet.LatLng[] = [];
        for (const pin of pins) {
            const marker = markers.get(pin.slug);
            if (!marker) continue;
            if (visible.has(pin.slug)) {
                if (!map.hasLayer(marker)) marker.addTo(map);
                shown.push(marker.getLatLng());
            } else marker.remove();
        }
        // Keep the visitor's own map view once they searched an area.
        if (shown.length > 0 && !state.bounds) {
            programmatic = true;
            map.fitBounds(L.latLngBounds(shown), { padding: [32, 32], maxZoom: 16 });
            programmatic = false;
        }
    }

    /** Sheet order: shown pins by distance from the visitor, or from the selected pin. */
    const sheetOrder = (): Pin[] => {
        const shown = new Set(shownCards.map((c) => c.dataset['listing']));
        const from = visitor ?? pins.find((p) => p.slug === state.selected) ?? null;
        const items = pins.filter((p) => shown.has(p.slug));
        return from ? items.sort((a, b) => distanceMetres(from, a) - distanceMetres(from, b)) : items;
    };

    const select = (slug: string) => {
        state.selected = slug;
        for (const [s, m] of markers) m.setIcon(pinIcon(s === slug));
        const pin = pins.find((p) => p.slug === slug);
        const card = cards.find((c) => c.dataset['listing'] === slug);
        const sheet = root.querySelector<HTMLElement>('[data-sheet]')!;
        for (const c of cards) c.classList.toggle('tkg-card-selected', c === card);
        if (!pin || !card) {
            sheet.hidden = true;
            return;
        }
        // Wide screens: the sheet becomes the highlighted card in the list.
        if (wide()) {
            if (card.hidden) card.hidden = false;
            card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        const compact = card.cloneNode(true) as HTMLElement;
        compact.hidden = false;
        compact.classList.add('tkg-card-compact');
        compact.classList.remove('tkg-card-selected');
        compact.querySelector('.tkg-card-sub')?.remove();
        root.querySelector('[data-sheet-card]')!.replaceChildren(compact);
        root.querySelector<HTMLAnchorElement>('[data-sheet-directions]')!.href = pin.directions;
        root.querySelector<HTMLAnchorElement>('[data-sheet-view]')!.href = pin.url;
        const order = sheetOrder();
        const pos = order.findIndex((p) => p.slug === slug);
        root.querySelector('[data-sheet-pos]')!.textContent = pos >= 0 ? t().sheetPos(pos + 1, order.length) : '';
        sheet.hidden = false;
    };

    /** Move the sheet to the next or previous place (swipe or arrows). */
    const step = (by: number) => {
        const order = sheetOrder();
        if (order.length === 0) return;
        const pos = order.findIndex((p) => p.slug === state.selected);
        const next = order[(pos + by + order.length) % order.length]!;
        select(next.slug);
        map?.panTo([next.lat, next.lng]);
    };

    const loadMap = async () => {
        if (map) return;
        const [leaflet] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
        L = (leaflet as unknown as { default?: typeof Leaflet }).default ?? leaflet;
        const [lat, lng] = (mapEl.dataset['center'] ?? '13.75,100.5').split(',').map(Number);
        const holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;inset:0';
        mapEl.prepend(holder);
        map = L.map(holder, { zoomControl: false, attributionControl: false }).setView([lat!, lng!], 14);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        for (const pin of pins) {
            const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(false), title: pin.name, keyboard: true });
            marker.on('click', () => {
                if (state.view !== 'map' && !wide()) {
                    state.view = 'map';
                    writeUrl();
                    render();
                    setInteractive();
                }
                select(pin.slug);
            });
            markers.set(pin.slug, marker);
        }
        // "Search this area" appears after the visitor pans or zooms; nothing changes
        // until it is tapped, so the sheet does not jump under the thumb.
        map.on('moveend', () => {
            if (!programmatic && interactive()) areaPill.hidden = false;
        });
        if (visitor) showYou();
        setInteractive();
        render();
    };

    const showYou = () => {
        if (!map || !L || !visitor) return;
        youMarker ??= L.marker([visitor.lat, visitor.lng], {
            icon: L.divIcon({ className: 'sg-you', iconSize: [14, 14] }),
            interactive: false
        }).addTo(map);
        youMarker.setLatLng([visitor.lat, visitor.lng]);
    };

    // --- events -------------------------------------------------------------------
    openBtn.addEventListener('click', () => {
        openChosen = true;
        state.open = !state.open;
        state.closedShown = false;
        writeUrl();
        render();
    });
    sortSelect.addEventListener('change', async () => {
        state.sort = sortSelect.value;
        writeUrl();
        if (state.sort === 'nearest' && !visitor) await locate();
        render();
    });
    root.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const stepBtn = target?.closest<HTMLElement>('[data-sheet-step]');
        if (stepBtn) {
            step(Number(stepBtn.dataset['sheetStep']));
            return;
        }
        const btn = target?.closest<HTMLElement>('[data-view-set]');
        if (!btn) return;
        state.view = btn.dataset['viewSet'] === 'map' ? 'map' : 'list';
        writeUrl();
        render();
        // Fit the pins once the map is visible (it may have loaded while hidden).
        void loadMap().then(() => {
            setInteractive();
            render();
        });
        window.scrollTo({ top: 0 });
    });
    areaPill.addEventListener('click', () => {
        if (!map) return;
        state.bounds = map.getBounds();
        state.limit = PAGE_SIZE;
        areaPill.hidden = true;
        render();
    });
    clearBounds.addEventListener('click', () => {
        state.bounds = null;
        render();
    });
    showMore.addEventListener('click', () => {
        state.limit += PAGE_SIZE;
        render();
    });
    showClosed.addEventListener('click', () => {
        state.closedShown = true;
        render();
    });
    // Swipe the map sheet sideways to move through the results.
    const sheetEl = root.querySelector<HTMLElement>('[data-sheet]')!;
    let swipeX: number | null = null;
    sheetEl.addEventListener('pointerdown', (e) => (swipeX = e.clientX));
    sheetEl.addEventListener('pointerup', (e) => {
        if (swipeX === null) return;
        const dx = e.clientX - swipeX;
        swipeX = null;
        if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
    });
    document.addEventListener('sg:refresh', render);
    document.addEventListener('sg:location', () => {
        showYou();
        render();
    });
    window.matchMedia(WIDE).addEventListener('change', setInteractive);

    // --- init ---------------------------------------------------------------------
    if ([...sortSelect.options].some((o) => o.value === state.sort)) sortSelect.value = state.sort;
    render();
    if (state.sort === 'nearest' && !visitor) void locate().then(render);
    // The map is below the top bar on every viewport: load it once the list has painted.
    const idle = (cb: () => void) =>
        'requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 200);
    idle(() => void loadMap());
}
