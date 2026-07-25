/**
 * RSVP ("I'm going") for upcoming events — real backend action via the same
 * EventGuest join connekt-mobile/knockout use. Not every event necessarily
 * supports open joining, so callers should handle a non-1 action gracefully
 * rather than assume success.
 */
import { api } from '../../api/client';

export async function joinEvent(eventId: string): Promise<{ ok: boolean; message?: string }> {
    try {
        const res = await api.post<{ action: number; message?: string }>('/customer/events/join', { eventId });
        return { ok: res.action === 1, message: res.message };
    } catch (err) {
        const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : undefined;
        return { ok: false, message };
    }
}

/**
 * Redeems an invite code to unlock a free, invite-only live stream — the
 * same endpoint knockout's web "Join Stream" gate uses. Unlike a generic
 * code-validity check, this actually grants access: on success it returns
 * the real WHEP playback URL, and confirms the code belongs to THIS event
 * (a code for a different event's stream fails with ok:false).
 */
export async function requestStreamAccess(
    eventId: string,
    inviteCode: string,
    viewerUsername: string,
): Promise<{ ok: boolean; whepUrl?: string; message?: string }> {
    try {
        const res = await api.post<{ action: number; message?: string; data?: { whepUrl?: string } }>(
            `/public/streams/${encodeURIComponent(eventId)}/access`,
            { inviteToken: inviteCode, viewerUsername },
            { skipAuth: true },
        );
        return { ok: res.action === 1, whepUrl: res.data?.whepUrl, message: res.message };
    } catch (err) {
        const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : undefined;
        return { ok: false, message };
    }
}

/**
 * The TV never gets a viewerId of its own — the phone completes /register
 * on knockout's /pay-to-watch page using the TV's deviceId as the
 * fingerprint, so the resulting viewerId only ever reaches the phone's
 * response, never the TV. This looks it up the only way the TV can: by the
 * fingerprint it already knows (its own persisted device id). Read-only,
 * doesn't grant access on its own — access-status still separately
 * re-verifies the fingerprint before returning a playable whepUrl.
 */
export async function resolveViewerIdByFingerprint(eventId: string, deviceFingerprint: string): Promise<string | null> {
    try {
        const res = await api.get<{ action: number; viewerId?: string | null }>(
            `/public/anonymous-viewer/${encodeURIComponent(eventId)}/resolve-by-fingerprint?fingerprint=${encodeURIComponent(deviceFingerprint)}`,
            { skipAuth: true },
        );
        return res.viewerId ?? null;
    } catch {
        return null;
    }
}

/**
 * Polled from the paid-event gate (see player.tsx's PayGatePanel) once a
 * viewerId is known (see resolveViewerIdByFingerprint above — access-status
 * unconditionally returns hasAccess:false without one). Mirrors knockout's
 * checkAnonymousAccessStatus (lib/APIs/streams/anonymous-viewer.ts) — same
 * `/public/anonymous-viewer/{eventId}/access-status` endpoint, fields are
 * top-level on the response (no nested `data`). `deviceMismatch:true` means
 * this viewer's paid access is currently bound to a DIFFERENT device (either
 * never this one, or switched away mid-stream) — see reason:"DEVICE_MISMATCH".
 */
export async function checkAnonymousStreamAccess(
    eventId: string,
    viewerId: string,
    deviceFingerprint: string,
): Promise<{ hasAccess: boolean; whepUrl?: string; deviceMismatch?: boolean }> {
    try {
        const res = await api.get<{ action: number; hasAccess?: boolean; whepUrl?: string; reason?: string }>(
            `/public/anonymous-viewer/${encodeURIComponent(eventId)}/access-status?fingerprint=${encodeURIComponent(deviceFingerprint)}&viewerId=${encodeURIComponent(viewerId)}`,
            { skipAuth: true },
        );
        return { hasAccess: !!res.hasAccess, whepUrl: res.whepUrl, deviceMismatch: res.reason === 'DEVICE_MISMATCH' };
    } catch {
        return { hasAccess: false };
    }
}

/**
 * Active variant of checkAnonymousStreamAccess, fired ONLY by the manual
 * "Already paid? Check now" button — never the silent 4s auto-poll. Where
 * access-status just reads the backend's stored payment status (and so stays
 * "not paid" until a webhook or the background poller catches up), this makes
 * the backend re-pull the viewer's XentriPay transaction directly. So a
 * genuinely-completed payment whose confirm-payment never landed (phone
 * closed mid-flow, mobile-money confirmation lag) still unlocks the instant
 * the viewer taps the button. Resolves the viewer by fingerprint server-side,
 * so — unlike access-status — the TV needs no viewerId of its own.
 */
export async function reconcileAnonymousStreamAccess(
    eventId: string,
    deviceFingerprint: string,
): Promise<{ hasAccess: boolean; whepUrl?: string; viewerId?: string; deviceMismatch?: boolean }> {
    try {
        const res = await api.post<{ action: number; hasAccess?: boolean; whepUrl?: string; viewerId?: string; reason?: string }>(
            `/public/anonymous-viewer/${encodeURIComponent(eventId)}/reconcile-by-fingerprint`,
            { fingerprint: deviceFingerprint },
            { skipAuth: true },
        );
        return { hasAccess: !!res.hasAccess, whepUrl: res.whepUrl, viewerId: res.viewerId, deviceMismatch: res.reason === 'DEVICE_MISMATCH' };
    } catch {
        return { hasAccess: false };
    }
}

/**
 * Establishes this TV's viewer session row right after access is first
 * granted — mirrors knockout's one-time anonymousDeviceCheck() call. Without
 * this, no AnonymousViewerSession row exists yet for heartbeat to update.
 * `conflict:true` means another device is already actively holding this
 * session (its own heartbeat is still within the 60s window).
 */
export async function confirmDeviceSession(
    eventId: string,
    viewerId: string,
    deviceFingerprint: string,
): Promise<{ ok: boolean; conflict?: boolean; message?: string }> {
    try {
        const res = await api.post<{ action: number; status?: string; message?: string }>(
            `/public/anonymous-viewer/${encodeURIComponent(eventId)}/device-check`,
            { viewerId, deviceFingerprint },
            { skipAuth: true },
        );
        return { ok: res.action === 1, conflict: res.status === 'DEVICE_CONFLICT', message: res.message };
    } catch (err) {
        const body = err && typeof err === 'object' ? (err as { status?: string; message?: string }) : {};
        return { ok: false, conflict: body.status === 'DEVICE_CONFLICT', message: body.message };
    }
}

/**
 * Keeps this device's session alive while actually watching — sessions go
 * stale after 60s with no heartbeat and can be silently displaced by
 * another device. Also doubles as the "was I kicked?" signal: the backend
 * rejects this with a device-mismatch error the moment another device
 * takes over via /switch-device, so a caller polling this on an interval
 * finds out within one tick. Mirrors knockout's anonymousHeartbeat (called
 * every 30s in live-stream.tsx).
 */
export async function sendAnonymousViewerHeartbeat(eventId: string, viewerId: string, deviceFingerprint: string): Promise<boolean> {
    try {
        const res = await api.post<{ action: number }>(
            `/public/anonymous-viewer/${encodeURIComponent(eventId)}/heartbeat`,
            { viewerId, deviceFingerprint },
            { skipAuth: true },
        );
        return res.action === 1;
    } catch {
        return false;
    }
}

/** Called on leaving the player so this device's session doesn't linger as
 *  "active" for the next 60s, blocking a legitimate switch elsewhere. */
export async function deactivateAnonymousViewerSession(eventId: string, deviceFingerprint: string): Promise<void> {
    try {
        await api.post(`/public/anonymous-viewer/${encodeURIComponent(eventId)}/deactivate`, { deviceFingerprint }, { skipAuth: true });
    } catch {
        // Best-effort - nothing the caller can do if this fails, and the
        // 60s heartbeat timeout is the fallback cleanup either way.
    }
}

/**
 * Broadcasts an emoji reaction to every viewer of this event — the same
 * `/public/events/{id}/reactions` endpoint knockout's web player uses to
 * drive its floating-emoji effect. No auth/payment required (reactions are
 * open to any viewer), rate-limited server-side per device fingerprint.
 */
export async function sendReaction(eventId: string, emoji: string, deviceFingerprint: string, name?: string): Promise<boolean> {
    try {
        const res = await api.post<{ action: number }>(
            `/public/events/${encodeURIComponent(eventId)}/reactions`,
            { emoji, deviceFingerprint, name },
            { skipAuth: true },
        );
        return res.action === 1;
    } catch {
        return false;
    }
}

export type StreamReaction = { id: string; message: string; timestamp?: string };

/**
 * Polls the same `/chats` endpoint the chat panel would use, but only reads
 * the `reactions` bucket — recent REACTION-type rows (server already keeps
 * these in their own bucket so a reaction storm can't starve real chat
 * messages out of the page, see the backend's getPublicStreamChats).
 */
export async function fetchRecentReactions(eventId: string, size = 20): Promise<StreamReaction[]> {
    try {
        const res = await api.get<{ reactions?: StreamReaction[] }>(
            `/public/events/${encodeURIComponent(eventId)}/chats?page=0&size=${size}`,
            { skipAuth: true },
        );
        return res.reactions ?? [];
    } catch {
        return [];
    }
}

export type StreamChatMessage = {
    id: string;
    viewerUsername?: string;
    viewerAvatar?: string;
    message: string;
    time?: string;
    chatType?: string;
};

/**
 * Read side of the same `/chats` endpoint fetchRecentReactions polls — the
 * `data` bucket (TEXT/VIDEO messages) rather than `reactions`. TV is
 * read-only for chat (see ChatPanel) - composing a reply happens on the
 * viewer's phone via the same public livestream page the gift QR points to.
 */
export async function fetchChatMessages(eventId: string, size = 30): Promise<StreamChatMessage[]> {
    try {
        const res = await api.get<{ data?: StreamChatMessage[] }>(
            `/public/events/${encodeURIComponent(eventId)}/chats?page=0&size=${size}`,
            { skipAuth: true },
        );
        return res.data ?? [];
    } catch {
        return [];
    }
}

/** Current live viewer count for this event — public, no auth required. */
export async function fetchViewerCount(eventId: string): Promise<number> {
    try {
        const res = await api.get<{ action: number; data?: { viewerCount?: number } }>(
            `/public/events/${encodeURIComponent(eventId)}/viewers`,
            { skipAuth: true },
        );
        return res.data?.viewerCount ?? 0;
    } catch {
        return 0;
    }
}

/**
 * Device-lock for a REAL logged-in customer watching a paid/group/token
 * stream on their own account (as opposed to the anonymous-viewer QR-pay
 * flow above, which has its own separate device lock). Auth token is
 * attached normally (no skipAuth) - the backend identifies the customer
 * from it, this only supplies which device. Same policy as the anonymous
 * flow: same device always fine, a different device is hard-blocked while
 * this one is still actively heartbeating, and there is no switch-device
 * override - only the 60s-idle auto-reassignment path exists.
 */
export async function checkStreamDeviceAccess(eventId: string, deviceId: string): Promise<{ ok: boolean; message?: string }> {
    try {
        const res = await api.post<{ action: number; message?: string }>(
            `/public/streams/${encodeURIComponent(eventId)}/device-check`,
            { deviceId },
        );
        return { ok: res.action === 1, message: res.message };
    } catch (err) {
        const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : undefined;
        return { ok: false, message };
    }
}

/** Keeps this device's authenticated-viewing session alive - see
 *  checkStreamDeviceAccess. Failing here means another device has taken
 *  over (after this one went quiet for 60s+), same kick-detection pattern
 *  as the anonymous flow's heartbeat. */
export async function sendStreamHeartbeat(eventId: string, deviceId: string): Promise<boolean> {
    try {
        const res = await api.post<{ action: number }>(`/public/streams/${encodeURIComponent(eventId)}/heartbeat`, { deviceId });
        return res.action === 1;
    } catch {
        return false;
    }
}
