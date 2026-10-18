/**
 * Account menu (header profile button and the Account tab's sheet, `AccountPanel.astro`).
 *
 * The site is static; accounts live in the owner app. This script asks that app who is signed
 * in (`GET <account>/api/soiguru/me`, with the owner app's cookie: same site, so it is sent) and
 * switches every panel between signed out (Sign in, Create account) and signed in (name, saved
 * places, settings, the business dashboard, sign out). The answer is kept in sessionStorage so
 * the next page shows the right state at once; it is refreshed on every page.
 *
 * Saved places: on the first answer after signing in, the places saved on this device are
 * added to the account (nothing is removed) and the device list becomes the account's list.
 * After that every heart tap is sent to the account (`POST /api/soiguru/saved`).
 *
 * Every account link gets the current page as its return address, so signing in, creating an
 * account or signing out comes back to the page the visitor was on.
 */
import { savedSlugs, setSavedSlugs } from './saved';

type Me =
    | { signedIn: false }
    | {
          signedIn: true;
          name: string | null;
          initial: string;
          isAdmin: boolean;
          isOwner: boolean;
          hasClaims: boolean;
          saved: string[];
      };

const CACHE = 'sg-acct-v1';
/** Set once the device's saved places were merged into the signed-in account. */
const SYNCED = 'sg-acct-synced-v1';

const panels = [...document.querySelectorAll<HTMLElement>('[data-acct-panel]')];
const account = accountOrigin();

function accountOrigin(): string | undefined {
    const link = document.querySelector<HTMLAnchorElement>('[data-acct-link="signin"]');
    if (!link) return undefined;
    try {
        return new URL(link.href).origin;
    } catch {
        return undefined;
    }
}

function store(kind: 'session' | 'local', key: string, value?: string | null): string | null {
    try {
        const s = kind === 'session' ? sessionStorage : localStorage;
        if (value === undefined) return s.getItem(key);
        if (value === null) s.removeItem(key);
        else s.setItem(key, value);
    } catch {
        // storage blocked: works for this page only
    }
    return null;
}

/** Return addresses: `/return?to=<this page>` (sign in, register) and `?to=` (sign out). */
function setLinks(): void {
    if (!account) return;
    const here = location.href.split('#')[0] ?? location.href;
    const th = document.documentElement.dataset['lang'] === 'th' ? '/th' : '';
    const back = encodeURIComponent(`/return?to=${encodeURIComponent(here)}`);
    for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-acct-link]')) {
        const kind = a.dataset['acctLink'];
        if (kind === 'signin') a.href = `${account}${th}/auth/signin?callbackUrl=${back}`;
        else if (kind === 'register') a.href = `${account}${th}/auth/register?callbackUrl=${back}`;
        else if (kind === 'signout') a.href = `${account}${th}/auth/signout?to=${encodeURIComponent(here)}`;
    }
}

function render(me: Me | null): void {
    const signedIn = !!me && me.signedIn;
    for (const p of panels) {
        const out = p.querySelector<HTMLElement>('[data-acct-out]');
        const inn = p.querySelector<HTMLElement>('[data-acct-in]');
        if (out) out.hidden = signedIn;
        if (inn) inn.hidden = !signedIn;
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-acct-initial]')) {
        el.textContent = signedIn ? me.initial : '';
        el.hidden = !signedIn;
    }
    for (const el of document.querySelectorAll<HTMLElement>('.sg-acct-icon')) {
        el.style.display = signedIn ? 'none' : '';
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-acct]')) {
        el.classList.toggle('is-signed-in', signedIn);
        el.querySelector('summary')?.setAttribute('aria-label', signedIn ? `Account: ${me.name ?? 'signed in'}` : 'Account');
    }
    if (!signedIn) return;
    for (const el of document.querySelectorAll<HTMLElement>('[data-acct-name]')) {
        el.textContent = me.name ?? (document.documentElement.dataset['lang'] === 'th' ? 'บัญชีของคุณ' : 'Your account');
    }
    for (const el of document.querySelectorAll<HTMLElement>('[data-acct-admin]')) el.hidden = !me.isAdmin;
    // Owners (or anyone with a claim in progress) see their dashboard; others the claim flow.
    const hasClaim = document.querySelector('[data-acct-claim]') !== null;
    for (const el of document.querySelectorAll<HTMLElement>('[data-acct-owner]')) el.hidden = hasClaim && !me.isOwner && !me.hasClaims;
    for (const el of document.querySelectorAll<HTMLElement>('[data-acct-claim]')) el.hidden = me.isOwner || me.hasClaims;
    renderCount();
}

function renderCount(): void {
    const n = savedSlugs().length;
    for (const el of document.querySelectorAll<HTMLElement>('[data-acct-saved-count]')) el.textContent = n ? String(n) : '';
}

async function call(path: string, init?: RequestInit): Promise<Response | null> {
    if (!account) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
        return await fetch(`${account}${path}`, { credentials: 'include', cache: 'no-store', signal: ctrl.signal, ...init });
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Send saved changes as text/plain (a simple request: no preflight). */
async function pushSaved(body: { add?: string[]; remove?: string[] }): Promise<string[] | null> {
    const res = await call('/api/soiguru/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(body)
    });
    if (!res?.ok) return null;
    const data = (await res.json().catch(() => null)) as { saved?: unknown } | null;
    return Array.isArray(data?.saved) ? data.saved.filter((s): s is string => typeof s === 'string') : null;
}

async function syncSaved(me: Extract<Me, { signedIn: true }>): Promise<void> {
    const local = savedSlugs();
    if (store('local', SYNCED) !== '1') {
        // First visit after signing in: merge this device's places into the account.
        const missing = local.filter((s) => !me.saved.includes(s));
        const merged = missing.length ? await pushSaved({ add: missing }) : me.saved;
        if (merged) {
            setSavedSlugs([...merged, ...local.filter((s) => !merged.includes(s))]);
            store('local', SYNCED, '1');
        }
    } else {
        // Already merged: the account is the list (saves from other devices show up here).
        setSavedSlugs(me.saved);
    }
    renderCount();
}

let current: Me | null = null;

async function refresh(): Promise<void> {
    const res = await call('/api/soiguru/me');
    if (!res?.ok) return; // owner app unreachable: keep what we showed
    const me = (await res.json().catch(() => null)) as Me | null;
    if (!me || typeof me.signedIn !== 'boolean') return;
    current = me;
    store('session', CACHE, JSON.stringify(me));
    render(me);
    if (me.signedIn) await syncSaved(me);
    else store('local', SYNCED, null);
}

if (account && panels.length) {
    setLinks();
    try {
        const cached = store('session', CACHE);
        if (cached) render((current = JSON.parse(cached) as Me));
    } catch {
        // ignore a broken cache
    }
    void refresh();
    // The language toggle rewrites the page in place: keep the return links in step.
    new MutationObserver(setLinks).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    document.addEventListener('sg:saved-toggle', (e) => {
        if (!current?.signedIn) return;
        const { slug, on } = (e as CustomEvent<{ slug: string; on: boolean }>).detail;
        void pushSaved(on ? { add: [slug] } : { remove: [slug] });
        renderCount();
    });
}
