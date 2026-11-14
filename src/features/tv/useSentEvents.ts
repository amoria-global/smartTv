import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'next/router';
import { pollSentEvent } from './cast';
import { createSentEventPoller } from './sentEventPoller';

// Screens where an event must not interrupt the viewer: signing in, first run.
const QUIET_ROUTES = ['/login', '/onboarding', '/splash', '/'];

function isOnScreen(): boolean {
    if (Platform.OS === 'web' && typeof document !== 'undefined') return document.visibilityState !== 'hidden';
    return AppState.currentState === 'active' || AppState.currentState == null;
}

/**
 * Opens the player when the phone sends an event to this TV. Mount once, at the app root.
 * Polls every 2 seconds while the app is on screen and at once when it comes back (see sentEventPoller).
 */
export function useSentEvents() {
    const router = useRouter();
    useEffect(() => {
        const poller = createSentEventPoller(
            {
                poll: pollSentEvent,
                shouldSkip: () => QUIET_ROUTES.includes(router.pathname),
                onEvent: (eventId) => {
                    // Already watching it: nothing to do.
                    if (router.pathname === '/player' && router.query.id === eventId) return;
                    router.push(`/player?id=${encodeURIComponent(eventId)}`);
                },
            },
            isOnScreen(),
        );

        const onChange = () => (isOnScreen() ? poller.resume() : poller.pause());
        const appState = AppState.addEventListener('change', onChange);
        const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
        if (isWeb) {
            document.addEventListener('visibilitychange', onChange);
            window.addEventListener('focus', poller.resume);
        }

        return () => {
            poller.stop();
            appState.remove();
            if (isWeb) {
                document.removeEventListener('visibilitychange', onChange);
                window.removeEventListener('focus', poller.resume);
            }
        };
    }, [router]);
}
