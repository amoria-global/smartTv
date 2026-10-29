/**
 * Send to TV, the TV side. A viewer on the phone's live page picks this TV and the backend holds the event
 * for it; this asks for it. The pairing code names the TV and the device secret (kept since pairing, never
 * shown) proves it is that TV, the same pair that guards the token handoff. The backend returns an event
 * once and then nothing, so a request is never replayed. Access to the stream is unchanged: the player still
 * applies its invite, payment and device checks.
 */
import { api } from '../../api/client';
import { storage, StorageKeys } from '../../services/storage';

/** The event id the phone sent to this TV, or null. A TV that paired before this existed has no secret and gets null. */
export async function pollSentEvent(): Promise<string | null> {
    const code = await storage.get(StorageKeys.tvPairingCode);
    const secret = await storage.get(StorageKeys.tvDeviceSecret);
    if (!code || !secret) return null;
    try {
        const res = await api.get<{ action: number; data?: { eventId?: string | null } }>(
            `/tv/cast/${encodeURIComponent(code)}`,
            { skipAuth: true, headers: { 'X-Device-Secret': secret } },
        );
        if (res.action !== 1) return null;
        return res.data?.eventId ?? null;
    } catch {
        // A missed poll is harmless: the next one is five seconds away.
        return null;
    }
}
