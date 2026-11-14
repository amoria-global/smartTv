import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSentEventPoller, MIN_GAP_MS, VISIBLE_POLL_MS } from './sentEventPoller';

/** Send to TV, the schedule: fast while on screen, silent while hidden, immediate on return. */

function setup(opts: { skip?: boolean; reply?: string | null; startVisible?: boolean } = {}) {
    const poll = vi.fn(async () => opts.reply ?? null);
    const onEvent = vi.fn();
    let skip = opts.skip ?? false;
    const poller = createSentEventPoller(
        { poll, onEvent, shouldSkip: () => skip, now: () => Date.now() },
        opts.startVisible ?? true,
    );
    return { poll, onEvent, poller, setSkip: (v: boolean) => (skip = v) };
}

// Lets the awaited poll settle after a timer fires.
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('createSentEventPoller', () => {
    it('polls at once, then every 2 seconds while the app is on screen', async () => {
        const { poll, poller } = setup();
        await flush();
        expect(poll).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS);
        expect(poll).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS * 3);
        expect(poll).toHaveBeenCalledTimes(5);
        poller.stop();
    });

    it('stays under the backend limit of 60 requests a minute per code', async () => {
        const { poll, poller } = setup();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(poll.mock.calls.length).toBeLessThanOrEqual(31);
        poller.stop();
    });

    it('asks nothing while the app is hidden', async () => {
        const { poll, poller } = setup();
        await flush();
        poller.pause();
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS * 10);
        expect(poll).toHaveBeenCalledTimes(1);
        poller.stop();
    });

    it('polls immediately when the app comes back on screen', async () => {
        const { poll, poller } = setup({ startVisible: false });
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS * 5);
        expect(poll).not.toHaveBeenCalled();
        poller.resume();
        await flush();
        expect(poll).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS);
        expect(poll).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    it('a focus and a visibility event together cost one request', async () => {
        const { poll, poller } = setup({ startVisible: false });
        poller.resume();
        poller.resume();
        await flush();
        expect(poll).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(MIN_GAP_MS);
        poller.resume();
        await flush();
        expect(poll).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    it('never overlaps a slow request with the next tick', async () => {
        let release: (v: string | null) => void = () => undefined;
        const poll = vi.fn(() => new Promise<string | null>((r) => (release = r)));
        const poller = createSentEventPoller({ poll, onEvent: vi.fn(), shouldSkip: () => false });
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS * 3);
        expect(poll).toHaveBeenCalledTimes(1);
        release(null);
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS);
        expect(poll).toHaveBeenCalledTimes(2);
        poller.stop();
    });

    it('keeps the quiet routes quiet', async () => {
        const { poll, poller, setSkip } = setup({ skip: true });
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS * 3);
        expect(poll).not.toHaveBeenCalled();
        setSkip(false);
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS);
        expect(poll).toHaveBeenCalledTimes(1);
        poller.stop();
    });

    it('hands over the event the phone sent, and nothing after stop', async () => {
        const { onEvent, poller } = setup({ reply: 'evt-42' });
        await flush();
        expect(onEvent).toHaveBeenCalledWith('evt-42');
        poller.stop();
        onEvent.mockClear();
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS * 3);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('keeps polling after a poll throws', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const poll = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(null);
        const poller = createSentEventPoller({ poll, onEvent: vi.fn(), shouldSkip: () => false });
        await flush();
        await vi.advanceTimersByTimeAsync(VISIBLE_POLL_MS);
        expect(poll).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenCalled();
        poller.stop();
        warn.mockRestore();
    });
});
