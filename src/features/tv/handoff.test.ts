import { describe, expect, it } from 'vitest';
import { phoneHandoffUrl } from './handoff';

describe('phoneHandoffUrl', () => {
    it('points the phone at the live stream page for this event', () => {
        expect(phoneHandoffUrl('42')).toBe('https://connekyt.com/user/events/live-stream?eventId=42');
    });

    it('encodes ids so the QR always holds one valid URL', () => {
        expect(phoneHandoffUrl('a b&c')).toBe('https://connekyt.com/user/events/live-stream?eventId=a%20b%26c');
    });
});
