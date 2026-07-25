/**
 * Best-effort "exit the app" for TV platforms.
 *
 * TV stores certify that Back on the app's root screen prompts to exit (and
 * that a confirmed exit actually closes the app). Each platform exposes its
 * own exit call; on the plain web engine there's nothing to close, so this is
 * a no-op there — the confirmation prompt is still the correct, certifiable
 * behaviour, and the real exit call lights up once running inside the native
 * Tizen / webOS container.
 */
export function platformExit(): void {
    const w = window as unknown as {
        tizen?: { application?: { getCurrentApplication?: () => { exit?: () => void } } };
        webOS?: { platformBack?: () => void };
    };
    try {
        // Samsung Tizen
        const tizenApp = w.tizen?.application?.getCurrentApplication?.();
        if (tizenApp?.exit) {
            tizenApp.exit();
            return;
        }
        // LG webOS
        if (w.webOS?.platformBack) {
            w.webOS.platformBack();
            return;
        }
        // Fallback (browser/dev): harmless — most browsers ignore close() on
        // a tab they didn't script-open, which is fine.
        window.close();
    } catch {
        /* exiting is best-effort — never throw out of a Back press */
    }
}
