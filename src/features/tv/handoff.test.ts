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

describe('phoneHandoffUrl with a guest purchase', () => {
    it('carries the purchase and this TV so the phone takes it over instead of paying again', () => {
        expect(phoneHandoffUrl('42', { viewerId: 'v-1', deviceId: 'tv 1' })).toBe(
            'https://connekyt.com/user/events/live-stream?eventId=42&handoff=v-1&from=tv%201',
        );
    });

    it('leaves the purchase out when the TV is not watching on one', () => {
        expect(phoneHandoffUrl('42', null)).toBe('https://connekyt.com/user/events/live-stream?eventId=42');
        expect(phoneHandoffUrl('42', { viewerId: '', deviceId: 'tv' })).toBe('https://connekyt.com/user/events/live-stream?eventId=42');
    });
});
