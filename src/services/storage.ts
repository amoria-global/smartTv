/**
 * Key-value storage for auth tokens. This app currently targets the `web`
 * engine (react-native-web), so it's backed by localStorage; the get/set/
 * remove shape matches connekt-mobile's storage service so a native
 * AsyncStorage/SecureStore backend can be swapped in later without touching
 * callers (once native TV builds are targeted).
 */

export const storage = {
    async get(key: string): Promise<string | null> {
        if (typeof globalThis.localStorage === 'undefined') return null;
        return globalThis.localStorage.getItem(key);
    },
    async set(key: string, value: string): Promise<void> {
        if (typeof globalThis.localStorage === 'undefined') return;
        globalThis.localStorage.setItem(key, value);
    },
    async remove(key: string): Promise<void> {
        if (typeof globalThis.localStorage === 'undefined') return;
        globalThis.localStorage.removeItem(key);
    },
};

export const StorageKeys = {
    authToken: 'auth.token',
    refreshToken: 'auth.refreshToken',
    session: 'auth.session',
    onboardingSeen: 'onboarding.seen',
    // Device-local playback preference (not synced to the backend — there's
    // no account-level "autoplay" concept in the domain model, only
    // per-device player behavior).
    autoplayEnabled: 'playback.autoplay',
    // Device-local streaming-quality preference (bandwidth is per-network).
    playbackQuality: 'playback.quality',
    // Device-local UI language choice.
    locale: 'app.locale',
    // Device-local saved-events list ("My List") — no account-level/backend
    // bookmarking concept exists yet, so this only persists per-device.
    bookmarkedEvents: 'bookmarks.events',
    // Random id minted once per TV install, used as the `deviceFingerprint`
    // for the anonymous-viewer pay-to-watch flow (see services/deviceId.ts).
    anonymousDeviceId: 'anonymous.deviceId',
    // Device-local "hide the floating reactions overlay" preference (see
    // player.tsx) — purely a display choice for this TV, not account-level.
    reactionsHidden: 'playback.reactionsHidden',
    // The pairing code and device secret of this TV, kept after pairing so the phone's "Send to TV" can find it.
    // The secret is what proves this is the paired device (see features/tv/cast.ts); it never reaches the screen.
    tvPairingCode: 'tv.pairingCode',
    tvDeviceSecret: 'tv.deviceSecret',
} as const;
