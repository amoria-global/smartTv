import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { pollSentEvent } from './cast';

const POLL_MS = 5000;
// Screens where an event must not interrupt the viewer: signing in, first run.
const QUIET_ROUTES = ['/login', '/onboarding', '/splash', '/'];

/** Opens the player when the phone sends an event to this TV. Mount once, at the app root. */
export function useSentEvents() {
    const router = useRouter();
    useEffect(() => {
        let stopped = false;
        const tick = async () => {
            if (QUIET_ROUTES.includes(router.pathname)) return;
            const eventId = await pollSentEvent();
            if (stopped || !eventId) return;
            // Already watching it: nothing to do.
            if (router.pathname === '/player' && router.query.id === eventId) return;
            router.push(`/player?id=${encodeURIComponent(eventId)}`);
        };
        const timer = setInterval(tick, POLL_MS);
        void tick();
        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [router]);
}
