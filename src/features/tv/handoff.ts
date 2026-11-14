/** Where "Continue on phone" sends the viewer: the event's live stream page, which the phone app also opens. */
export const PHONE_HANDOFF_BASE_URL = 'https://connekyt.com/user/events/live-stream';

export function phoneHandoffUrl(eventId: string): string {
    return `${PHONE_HANDOFF_BASE_URL}?eventId=${encodeURIComponent(eventId)}`;
}
