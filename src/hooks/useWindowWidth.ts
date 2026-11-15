import { useEffect, useState } from 'react';

/**
 * Live browser viewport width, kept in sync via a `resize` listener.
 *
 * Grid pages (events/search/my-list) used to measure their own rendered
 * width via RN's `onLayout` to size cards for a real column-fill instead of
 * a fixed guess — but `onLayout` never actually fires for these plain
 * `View`s in this react-native-web setup, so `gridWidth` stayed stuck at 0
 * forever and cards silently fell back to a small fixed width, wasting most
 * of a TV-sized screen. `window.innerWidth` is reliable here since this app
 * only ever runs in a real DOM (web engine), unlike native RN.
 */
export function useWindowWidth(): number {
    // The first render must match the server's (1920), otherwise React keeps the
    // server-rendered class names on hydration and a phone is stuck with the TV layout.
    // The real width is read right after mount.
    const [width, setWidth] = useState(1920);

    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return width;
}
