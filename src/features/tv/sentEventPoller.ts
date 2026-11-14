/**
 * The schedule behind Send to TV: how often the TV asks GET /tv/cast/{code} whether the phone sent an event.
 *
 * Every 2 seconds while the app is on screen, so an event sent from the phone opens within about two
 * seconds. The backend allows 60 requests a minute per code, so 30 a minute leaves room for the extra
 * polls below. Nothing is asked while the app is hidden, and the TV asks at once when it comes back,
 * so a viewer who switches inputs and returns does not wait for the next tick. Polls never overlap and
 * never run closer than MIN_GAP_MS, so a focus and a visibility event arriving together cost one request.
 *
 * No React or platform imports, so vitest can drive it with fake timers.
 */

export const VISIBLE_POLL_MS = 2000;
export const MIN_GAP_MS = 1000;

export type SentEventPollerDeps = {
    /** Asks the backend; resolves to the sent event id, or null. */
    poll: () => Promise<string | null>;
    /** True when a poll should not run on this screen (signing in, first run). */
    shouldSkip: () => boolean;
    /** Called with the event id the phone sent. */
    onEvent: (eventId: string) => void;
    now?: () => number;
};

export type SentEventPoller = {
    /** The app is on screen again (visible or focused): poll now and resume the 2 second cadence. */
    resume: () => void;
    /** The app is hidden: stop asking until it resumes. */
    pause: () => void;
    stop: () => void;
};

export function createSentEventPoller(deps: SentEventPollerDeps, startVisible = true): SentEventPoller {
    const now = deps.now ?? Date.now;
    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;
    let stopped = false;
    let lastPollAt = -Infinity;

    const tick = async () => {
        if (stopped || inFlight || deps.shouldSkip()) return;
        if (now() - lastPollAt < MIN_GAP_MS) return;
        inFlight = true;
        lastPollAt = now();
        try {
            const eventId = await deps.poll();
            if (!stopped && eventId) deps.onEvent(eventId);
        } catch (err) {
            // pollSentEvent already turns failures into null, so a throw here is a bug upstream. Log it
            // and wait for the next tick rather than stopping Send to TV.
            console.warn('Send to TV poll failed', err);
        } finally {
            inFlight = false;
        }
    };

    const clear = () => {
        if (timer) clearInterval(timer);
        timer = null;
    };

    const resume = () => {
        if (stopped) return;
        clear();
        timer = setInterval(() => void tick(), VISIBLE_POLL_MS);
        void tick();
    };

    const pause = () => clear();

    if (startVisible) resume();

    return {
        resume,
        pause,
        stop: () => {
            stopped = true;
            clear();
        },
    };
}
