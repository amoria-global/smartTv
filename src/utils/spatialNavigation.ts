/**
 * Global D-pad / arrow-key spatial navigation for the web (TV) engine.
 *
 * Why this exists: on a real TV remote the directional pad sends arrow keys,
 * but browsers have NO built-in spatial focus movement — Tab walks DOM order,
 * and arrow keys just scroll the page. react-native-web already puts
 * `tabindex="0"` on every Touchable (and useFocusNav already draws the focus
 * ring from the resulting onFocus/onBlur), so all that's missing is the layer
 * that translates an arrow press into "focus the nearest focusable element in
 * that direction." That's this module. It plugs in globally (initialised once
 * from _app.tsx) and needs zero changes to individual components.
 *
 * Also handles:
 *  - Enter/OK  -> activates (clicks) the focused element, since a focused
 *    RN-web Touchable renders as a <div> that doesn't self-activate on Enter.
 *  - Modal focus trapping — while a full-screen overlay (any modal/gate) is
 *    open, navigation is scoped to inside it so the D-pad can't wander onto
 *    the background behind the dialog.
 *  - Text inputs — left/right are left to the browser (move the caret); only
 *    up/down move focus out of the field.
 */

type Dir = 'up' | 'down' | 'left' | 'right';
type Rect = { x: number; y: number; cx: number; cy: number; right: number; bottom: number };

const FOCUSABLE_SELECTOR = '[tabindex]:not([tabindex="-1"]), a[href], input, textarea, select, button';

function rectOf(el: Element): Rect {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

function isVisible(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') return false;
    return true;
}

/**
 * The nearest ancestor of `el` that is a full-screen positioned overlay (a
 * modal/gate backdrop). Detected structurally — position fixed/absolute and
 * covering ~the whole viewport — so it works for any of the app's overlays
 * without them needing a special marker. Returns null for ordinary page
 * content (the main screen root is position:relative, so it never matches).
 */
function overlayAncestor(el: Element | null): HTMLElement | null {
    let node = el as HTMLElement | null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (style.position === 'fixed' || style.position === 'absolute') {
            const r = node.getBoundingClientRect();
            if (r.width >= vw * 0.9 && r.height >= vh * 0.9) return node;
        }
        node = node.parentElement;
    }
    return null;
}

function focusables(scope: ParentNode): HTMLElement[] {
    return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

/** Is `cand` in direction `dir` from `cur` (compared by centres, with a 1px
 *  dead-zone so near-coplanar elements don't count as "in front"). */
function inDirection(dir: Dir, cur: Rect, cand: Rect): boolean {
    switch (dir) {
        case 'up':
            return cand.cy < cur.cy - 1;
        case 'down':
            return cand.cy > cur.cy + 1;
        case 'left':
            return cand.cx < cur.cx - 1;
        case 'right':
            return cand.cx > cur.cx + 1;
    }
}

/** Lower is better. Distance along the axis of travel, plus a heavy penalty
 *  for perpendicular misalignment so the pick stays in the same row/column
 *  when possible (the standard spatial-nav heuristic). */
function score(dir: Dir, cur: Rect, cand: Rect): number {
    const dx = Math.abs(cand.cx - cur.cx);
    const dy = Math.abs(cand.cy - cur.cy);
    const primary = dir === 'up' || dir === 'down' ? dy : dx;
    const secondary = dir === 'up' || dir === 'down' ? dx : dy;
    return primary + secondary * 3;
}

function bestCandidate(dir: Dir, current: HTMLElement, candidates: HTMLElement[]): HTMLElement | null {
    const cur = rectOf(current);
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const cand of candidates) {
        if (cand === current) continue;
        const cr = rectOf(cand);
        if (!inDirection(dir, cur, cr)) continue;
        const s = score(dir, cur, cr);
        if (s < bestScore) {
            bestScore = s;
            best = cand;
        }
    }
    return best;
}

const KEY_DIR: Record<string, Dir> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

function isTextInput(el: Element | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;
    const type = (el as HTMLInputElement).type;
    return ['text', 'search', 'email', 'password', 'url', 'tel', 'number'].includes(type);
}

/**
 * Attach the global handler. Returns a disposer. Safe to call only in the
 * browser (guarded by the caller's useEffect).
 */
export function initSpatialNavigation(): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
        const dir = KEY_DIR[e.key];
        const active = document.activeElement as HTMLElement | null;
        const inInput = isTextInput(active);

        if (dir) {
            // In a text field, left/right move the caret — leave those to the
            // browser; only up/down pull focus out of the field.
            if (inInput && (dir === 'left' || dir === 'right')) return;

            // Scope to the open overlay (modal/gate) if there is one, so the
            // D-pad can't escape onto the background behind it.
            const scope = overlayAncestor(active) ?? document.body;
            const candidates = focusables(scope);

            // Nothing focused yet (e.g. very first keypress) — land on the
            // first focusable rather than doing nothing.
            if (!active || active === document.body) {
                const first = candidates[0];
                if (first) {
                    e.preventDefault();
                    first.focus();
                    first.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
                return;
            }

            const next = bestCandidate(dir, active, candidates);
            if (next) {
                e.preventDefault();
                next.focus();
                next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            } else {
                // No target in that direction — still swallow the key so the
                // page doesn't do a native scroll jump on a TV.
                e.preventDefault();
            }
            return;
        }

        // OK / select — a focused RN-web Touchable is a <div> that won't
        // activate itself on Enter, so click it. Skip inside text inputs
        // (Enter there should do nothing disruptive; search debounces anyway).
        if ((e.key === 'Enter' || e.key === 'NavigationEnter') && active && !inInput) {
            e.preventDefault();
            active.click();
        }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
}
