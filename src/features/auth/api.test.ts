import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The TV side of pairing and sign-out (CONN-TEST-6).
 *
 * Every decision pinned here came out of the SmartTV epic, and until this file
 * nothing in the TV repo tested any of them. The suite that did exist covered
 * dates, countdowns and locale strings.
 *
 * The client and storage modules are replaced, so these run in plain node with
 * no React Native, and assert exactly what the TV sends and what it keeps.
 */

const calls: { method: 'get' | 'post'; path: string; body?: unknown; options?: any }[] = [];
let nextResponse: unknown;
let failNextCall = false;

vi.mock('../../api/client', () => ({
    api: {
        get: vi.fn(async (path: string, options?: unknown) => {
            calls.push({ method: 'get', path, options });
            if (failNextCall) throw { status: 500, message: 'network' };
            return nextResponse;
        }),
        post: vi.fn(async (path: string, body?: unknown, options?: unknown) => {
            calls.push({ method: 'post', path, body, options });
            if (failNextCall) throw { status: 500, message: 'network' };
            return nextResponse;
        }),
    },
}));

const stored = new Map<string, string>();
vi.mock('../../services/storage', () => ({
    storage: {
        get: vi.fn(async (k: string) => stored.get(k) ?? null),
        set: vi.fn(async (k: string, v: string) => void stored.set(k, v)),
        remove: vi.fn(async (k: string) => void stored.delete(k)),
    },
    StorageKeys: {
        authToken: 'auth.token',
        refreshToken: 'auth.refreshToken',
        session: 'auth.session',
        tvPairingCode: 'tv.pairingCode',
        tvDeviceSecret: 'tv.deviceSecret',
    },
}));

const auth = await import('./api');

beforeEach(() => {
    calls.length = 0;
    stored.clear();
    nextResponse = undefined;
    failNextCall = false;
});

const envelope = (data: unknown) => ({ action: 1, data });

describe('pollTvPairingStatus: what the TV sends', () => {
    it('sends the device secret as a header, never in the URL', async () => {
        nextResponse = envelope({ status: 'PENDING' });

        await auth.pollTvPairingStatus('ABC123', 'the-device-secret');

        // CONN-TV-1: the secret is what unlocks the session. In a path it
        // lands in nginx access logs and any proxy log along the way.
        expect(calls[0].path).not.toContain('the-device-secret');
        expect(calls[0].options.headers).toEqual({ 'X-Device-Secret': 'the-device-secret' });
    });

    it('sends no secret header at all when it has none', async () => {
        nextResponse = envelope({ status: 'PENDING' });

        await auth.pollTvPairingStatus('ABC123');

        expect(calls[0].options.headers).toBeUndefined();
    });

    it('polls without a bearer token, because an unpaired TV has none', async () => {
        nextResponse = envelope({ status: 'PENDING' });

        await auth.pollTvPairingStatus('ABC123', 's');

        expect(calls[0].options.skipAuth).toBe(true);
    });

    it('encodes the pairing code into the path', async () => {
        nextResponse = envelope({ status: 'PENDING' });

        await auth.pollTvPairingStatus('A B/C', 's');

        expect(calls[0].path).toBe('/tv/pairing/status/A%20B%2FC');
    });
});

describe('pollTvPairingStatus: what the TV does with each answer', () => {
    it('keeps waiting on PENDING, and stores nothing', async () => {
        nextResponse = envelope({ status: 'PENDING' });

        await expect(auth.pollTvPairingStatus('ABC123', 's')).resolves.toBeNull();
        expect(stored.size).toBe(0);
    });

    it('claims the session on ACTIVE and keeps both tokens', async () => {
        nextResponse = envelope({
            status: 'ACTIVE',
            action: 1,
            token: 'access.tv',
            refreshToken: 'refresh.tv',
            customerId: 'c-1',
            firstName: 'Ada',
            customerType: 'event_coordinator',
        });

        const session = await auth.pollTvPairingStatus('ABC123', 's');

        expect(session?.token).toBe('access.tv');
        expect(stored.get('auth.token')).toBe('access.tv');
        expect(stored.get('auth.refreshToken'))
            .toBe('refresh.tv');
        expect(session?.user.customerType).toBe('Coordinator');
    });

    it('keeps the pairing code and device secret so Send to TV can reach this TV', async () => {
        nextResponse = envelope({ status: 'ACTIVE', action: 1, token: 'access.tv', refreshToken: 'refresh.tv', customerId: 'c-1' });

        await auth.pollTvPairingStatus('ABC123', 'device-secret');

        expect(stored.get('tv.pairingCode')).toBe('ABC123');
        expect(stored.get('tv.deviceSecret')).toBe('device-secret');

        await auth.clearSession();
        expect(stored.has('tv.pairingCode')).toBe(false);
        expect(stored.has('tv.deviceSecret')).toBe(false);
    });

    it('does not need an email in the handoff', async () => {
        // CONN-TV-5 removed email from the pairing payload on purpose: the
        // TV never shows it, so it should never have been sent to a screen in
        // someone's living room.
        nextResponse = envelope({ status: 'ACTIVE', token: 'access.tv', refreshToken: 'refresh.tv', customerId: 'c-1' });

        const session = await auth.pollTvPairingStatus('ABC123', 's');

        expect(session).not.toBeNull();
        expect(session?.user.email).toBe('');
    });

    it('treats an ACTIVE answer without tokens as nothing to claim', async () => {
        // What the backend sends to a caller without the device secret:
        // lifecycle state only. The TV must not store a half session.
        nextResponse = envelope({ status: 'ACTIVE' });

        await expect(auth.pollTvPairingStatus('ABC123')).resolves.toBeNull();
        expect(stored.size).toBe(0);
    });

    it('does not claim twice once the session is already held', async () => {
        nextResponse = envelope({ status: 'ALREADY_CLAIMED' });

        await expect(auth.pollTvPairingStatus('ABC123', 's')).resolves.toBeNull();
        expect(stored.size).toBe(0);
    });

    it('offers a fresh code when the code expired', async () => {
        nextResponse = envelope({ status: 'EXPIRED' });

        await expect(auth.pollTvPairingStatus('ABC123', 's')).rejects.toMatchObject({
            status: 410,
            message: expect.stringMatching(/expired/i),
        });
    });

    it('tells a disconnected TV it was disconnected, instead of offering to re-pair', async () => {
        nextResponse = envelope({ status: 'REVOKED' });

        const failure = auth.pollTvPairingStatus('ABC123', 's');

        // Someone removed this TV from their account. "Refresh for a new code"
        // here would quietly re-pair a device that was deliberately cut off.
        await expect(failure).rejects.toMatchObject({ status: 410, message: expect.stringMatching(/disconnected/i) });
        await expect(auth.pollTvPairingStatus('ABC123', 's')).rejects.not.toMatchObject({
            message: expect.stringMatching(/refresh/i),
        });
    });

    it('treats action 0 as a failure even though it arrived as HTTP 200', async () => {
        nextResponse = { action: 0, message: 'Pairing session not found' };

        await expect(auth.pollTvPairingStatus('ABC123', 's')).rejects.toMatchObject({ status: 400 });
        expect(stored.size).toBe(0);
    });
});

describe('initiateTvPairing', () => {
    it('starts without authentication and returns the code to show', async () => {
        nextResponse = envelope({ pairingCode: 'ABC123', deviceSecret: 's', expiresAt: '2026-01-01T00:00:00Z' });

        const started = await auth.initiateTvPairing();

        expect(calls[0]).toMatchObject({ method: 'post', path: '/tv/pairing/initiate' });
        expect(calls[0].options.skipAuth).toBe(true);
        expect(started).toMatchObject({ pairingCode: 'ABC123' });
    });

    it('fails on action 0 rather than showing an empty code', async () => {
        nextResponse = { action: 0, message: 'Too many pairing attempts' };

        await expect(auth.initiateTvPairing()).rejects.toMatchObject({ message: 'Too many pairing attempts' });
    });
});

describe('signing out on the TV', () => {
    it('signs out this TV only, never the phone or the dashboard', async () => {
        stored.set('auth.refreshToken', 'refresh.tv');

        await auth.logout();

        // CONN-AUTH-7: /auth/logout ends every session on the account. A TV
        // using it would sign the owner out of their phone from the sofa.
        expect(calls).toHaveLength(1);
        expect(calls[0].path).toBe('/auth/logout-device');
        expect(calls[0].body).toEqual({ refreshToken: 'refresh.tv' });
    });

    it('clears local state even when the server cannot be reached', async () => {
        stored.set('auth.token', 'access.tv');
        stored.set('auth.refreshToken', 'refresh.tv');
        stored.set('auth.session', '{}');
        failNextCall = true;

        await auth.logout();

        expect(stored.size).toBe(0);
    });

    it('keeps "sign out everywhere" a separate, deliberate call', async () => {
        stored.set('auth.token', 'access.tv');

        await auth.logoutAllDevices();

        expect(calls[0].path).toBe('/auth/logout');
        expect(stored.size).toBe(0);
    });
});

describe('login on the TV', () => {
    it('treats action 0 as a failure even though it arrived as HTTP 200', async () => {
        nextResponse = { action: 0, message: 'Invalid credentials' };

        await expect(auth.login({ email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
            status: 401,
            message: 'Invalid credentials',
        });
        expect(stored.size).toBe(0);
    });
});
