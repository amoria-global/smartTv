import { useEffect, useState } from 'react';

/**
 * Phone detection for the few screens that switch to a stacked layout below `breakpoint`.
 *
 * It is separate from useWindowWidth on purpose: that hook feeds the desktop and TV grids and
 * must keep behaving exactly as it always has. Here the first render matches the server's
 * (not compact), so React keeps the matching markup on hydration, and the real width is read
 * right after mount. On any screen wider than the breakpoint this never changes anything.
 */
export function useViewport(breakpoint: number): { width: number; compact: boolean } {
    const [width, setWidth] = useState(1920);

    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return { width, compact: width < breakpoint };
}
