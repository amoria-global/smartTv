import { useState } from 'react';

/**
 * Minimal focus-state helper for TV-focusable elements — just tracks whether
 * this element currently has focus, so components can draw their focus ring.
 * It does NOT move focus; that's the global D-pad spatial navigation
 * (utils/spatialNavigation, wired in _app.tsx), which `.focus()`es the
 * nearest element in the pressed direction. That fires the DOM focus/blur
 * events RN Web maps to these onFocus/onBlur handlers (Touchables get a
 * tabIndex automatically), so the ring lights up wherever the remote lands.
 */
export function useFocusNav() {
    const [focused, setFocused] = useState(false);
    return {
        focused,
        focusProps: {
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
        },
    };
}
