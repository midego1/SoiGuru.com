/**
 * Sheets (`Sheet.astro`): open `<dialog data-sheet-dialog="id">` from any
 * `[data-sheet-open="id"]`, close on `[data-sheet-close]` or a tap on the scrim.
 * Dispatches `sg:sheet-open` / `sg:sheet-close` on the dialog for page scripts.
 */

document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const opener = target?.closest<HTMLElement>('[data-sheet-open]');
    if (opener) {
        const dialog = document.querySelector<HTMLDialogElement>(`[data-sheet-dialog="${opener.dataset['sheetOpen']}"]`);
        if (dialog && !dialog.open) {
            dialog.showModal();
            dialog.dispatchEvent(new CustomEvent('sg:sheet-open'));
        }
        return;
    }
    const dialog = target?.closest<HTMLDialogElement>('dialog[data-sheet-dialog]');
    if (!dialog) return;
    // A click on the dialog element itself (not its content) is a click on the scrim.
    if (target === dialog || target?.closest('[data-sheet-close]')) dialog.close();
});

for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[data-sheet-dialog]')) {
    dialog.addEventListener('close', () => dialog.dispatchEvent(new CustomEvent('sg:sheet-close')));
}
