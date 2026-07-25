/**
 * Persistent, per-install anonymous-viewer device id — the TV's counterpart
 * to the browser fingerprint knockout's web anonymous-viewer flow computes
 * from hardware signals (see knockout/lib/fingerprint.ts). A TV has no
 * "buyer's browser" to fingerprint (the phone that pays is a different,
 * disposable browser session), so instead we mint one random id per TV
 * install and persist it — the backend only needs a stable string that
 * identifies "this device" across a register → pay → poll cycle, not a
 * hardware-derived one.
 */
import { storage, StorageKeys } from './storage';

let cached: string | null = null;

function randomId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    // Fallback for engines without crypto.randomUUID (older WebViews).
    return `tv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getTvDeviceId(): Promise<string> {
    if (cached) return cached;
    const existing = await storage.get(StorageKeys.anonymousDeviceId);
    if (existing) {
        cached = existing;
        return existing;
    }
    const id = randomId();
    await storage.set(StorageKeys.anonymousDeviceId, id);
    cached = id;
    return id;
}
