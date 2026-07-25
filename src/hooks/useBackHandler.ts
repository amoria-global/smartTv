import { useEffect, useRef } from 'react';
import { pushBackHandler } from '../utils/backHandler';

/**
 * While `active` is true, the TV remote's Back key runs `onBack` (and stops
 * there) instead of navigating away — use it in any modal/overlay so Back
 * closes it. `onBack` should perform the close; it's always treated as
 * consuming the press.
 *
 * The latest `onBack` is captured in a ref so the registration doesn't churn
 * on every render — only `active` toggling adds/removes it from the stack.
 */
export function useBackHandler(onBack: () => void, active: boolean): void {
    const ref = useRef(onBack);
    ref.current = onBack;

    useEffect(() => {
        if (!active) return;
        return pushBackHandler(() => {
            ref.current();
            return true;
        });
    }, [active]);
}
