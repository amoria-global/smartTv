/**
 * TV remote Back / Return key handling for the web engine — the web analogue
 * of React Native's BackHandler.
 *
 * Different TV platforms send the Back key as different things (there's no one
 * standard): a bare `Escape`, `Backspace`, `GoBack`/`BrowserBack`, `XF86Back`,
 * or a platform keyCode (Tizen 10009, webOS 461). This normalises all of them
 * to one "back" action.
 *
 * Behaviour, in order:
 *   1. If an overlay/modal has registered a handler (via useBackHandler while
 *      open), the top-most one runs and consumes the press — Back closes the
 *      dialog instead of leaving the screen. This mirrors what a TV viewer
 *      expects: Back dismisses what's on top first.
 *   2. Otherwise the default runs — router.back() (set once in _app.tsx).
 *
 * Text fields are respected: a physical Backspace while typing deletes a
 * character rather than triggering "back".
 */

type BackHandler = () => boolean; // return true if it handled (consumed) the press

const stack: BackHandler[] = [];
let defaultHandler: () => void = () => {};
let listening = false;

const BACK_KEYS = new Set(['Escape', 'GoBack', 'BrowserBack', 'XF86Back']);
// Tizen (10009) and webOS (461) Return keys; 8 is Backspace (handled with the
// text-field guard below).
const BACK_KEYCODES = new Set([10009, 461]);

function isTextInput(el: Element | null): boolean {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    const type = (el as HTMLInputElement).type;
    return ['text', 'search', 'email', 'password', 'url', 'tel', 'number'].includes(type);
}

function onKeyDown(e: KeyboardEvent) {
    const active = document.activeElement;
    const isBackspace = e.key === 'Backspace' || e.keyCode === 8;
    // Backspace only counts as "back" outside a text field — inside one it's
    // an edit key.
    const isBack =
        BACK_KEYS.has(e.key) ||
        BACK_KEYCODES.has(e.keyCode) ||
        (isBackspace && !isTextInput(active));
    if (!isBack) return;

    e.preventDefault();
    for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]()) return; // top-most overlay consumed it
    }
    defaultHandler();
}

/** Register the fallback (used when no overlay is open) and start listening.
 *  Call once, from _app.tsx. Returns a disposer. */
export function initBackHandler(fallback: () => void): () => void {
    defaultHandler = fallback;
    if (!listening) {
        window.addEventListener('keydown', onKeyDown);
        listening = true;
    }
    return () => {
        window.removeEventListener('keydown', onKeyDown);
        listening = false;
    };
}

/** Push an overlay's back handler; returns an unregister fn. */
export function pushBackHandler(handler: BackHandler): () => void {
    stack.push(handler);
    return () => {
        const i = stack.indexOf(handler);
        if (i >= 0) stack.splice(i, 1);
    };
}
