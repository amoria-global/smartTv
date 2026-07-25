import { useEffect, useState } from 'react';

/** Live browser viewport height, kept in sync via a `resize` listener —
 *  height counterpart to useWindowWidth. Lets a screen shrink its own
 *  spacing/sizing to fit shorter viewports instead of either overlapping
 *  content or falling back to a scrollable layout (undesirable on a TV
 *  remote — there's no scroll wheel, and drilling a focus target down
 *  through off-screen content is a bad 10-foot experience). */
export function useWindowHeight(): number {
    const [height, setHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 1080));

    useEffect(() => {
        const onResize = () => setHeight(window.innerHeight);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return height;
}
