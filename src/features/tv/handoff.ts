/** Where "Continue on phone" sends the viewer: the event's live stream page, which the phone app also opens. */
export const PHONE_HANDOFF_BASE_URL = 'https://connekyt.com/user/events/live-stream';

/**
 * The purchase a guest is watching on this TV, if any: carried in the QR so the phone takes it over instead of paying
 * again. The live page moves it with the backend's hand-to-tv call, which only works from this TV's device id; the TV
 * then stops (its next heartbeat is refused and it shows the usual notice), so the stream plays on one screen at a time.
 */
export type GuestAccess = { viewerId: string; deviceId: string };

export function phoneHandoffUrl(eventId: string, guest?: GuestAccess | null): string {
    const url = `${PHONE_HANDOFF_BASE_URL}?eventId=${encodeURIComponent(eventId)}`;
    if (!guest?.viewerId || !guest.deviceId) return url;
    return `${url}&handoff=${encodeURIComponent(guest.viewerId)}&from=${encodeURIComponent(guest.deviceId)}`;
}
