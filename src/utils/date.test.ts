import { describe, it, expect } from 'vitest';
import { formatDateBadge } from './date';

describe('formatDateBadge', () => {
    it('returns null without a date', () => {
        expect(formatDateBadge(undefined)).toBeNull();
    });

    it('returns null for an unparseable date', () => {
        expect(formatDateBadge('nonsense')).toBeNull();
    });

    it('splits an ISO date into an uppercase month + zero-padded day', () => {
        const badge = formatDateBadge('2026-08-05', 'en');
        expect(badge).toEqual({ month: 'AUG', day: '05' });
    });

    it('keeps two-digit days unpadded', () => {
        expect(formatDateBadge('2026-12-25', 'en')?.day).toBe('25');
    });
});
