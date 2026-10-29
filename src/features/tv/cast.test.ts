import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Send to TV, the TV side: what it asks for, with what proof, and what it does when there is nothing. */

const calls: { path: string; options?: any }[] = [];
let nextResponse: unknown;
let failNextCall = false;

vi.mock('../../api/client', () => ({
    api: {
        get: vi.fn(async (path: string, options?: unknown) => {
            calls.push({ path, options });
            if (failNextCall) throw { status: 500, message: 'network' };
            return nextResponse;
        }),
    },
}));

const stored = new Map<string, string>();
vi.mock('../../services/storage', () => ({
    storage: {
        get: vi.fn(async (k: string) => stored.get(k) ?? null),
    },
    StorageKeys: { tvPairingCode: 'tv.pairingCode', tvDeviceSecret: 'tv.deviceSecret' },
}));

const { pollSentEvent } = await import('./cast');

beforeEach(() => {
    calls.length = 0;
    stored.clear();
    nextResponse = undefined;
    failNextCall = false;
});

describe('pollSentEvent', () => {
    it('asks nothing of the backend until the TV has paired and holds its secret', async () => {
        expect(await pollSentEvent()).toBeNull();
        stored.set('tv.pairingCode', 'ABC234');
        expect(await pollSentEvent()).toBeNull();
        expect(calls).toHaveLength(0);
    });

    it('proves it is the paired TV with the device secret header, without an account session', async () => {
        stored.set('tv.pairingCode', 'ABC234');
        stored.set('tv.deviceSecret', 'secret-1');
        nextResponse = { action: 1, data: { eventId: 'evt-1' } };

        expect(await pollSentEvent()).toBe('evt-1');

        expect(calls[0].path).toBe('/tv/cast/ABC234');
        expect(calls[0].options.skipAuth).toBe(true);
        expect(calls[0].options.headers).toEqual({ 'X-Device-Secret': 'secret-1' });
    });

    it('returns null when nothing was sent', async () => {
        stored.set('tv.pairingCode', 'ABC234');
        stored.set('tv.deviceSecret', 'secret-1');
        nextResponse = { action: 1, data: { eventId: null } };

        expect(await pollSentEvent()).toBeNull();
    });

    it('treats a failed poll as nothing to open, because the next poll is seconds away', async () => {
        stored.set('tv.pairingCode', 'ABC234');
        stored.set('tv.deviceSecret', 'secret-1');
        failNextCall = true;

        expect(await pollSentEvent()).toBeNull();
    });
});
