import { describe, it, expect } from 'vitest';
import { splitCountdown, pad2, parseEventStart, formatShortCountdown } from './countdown';

const S = 1000;
const MIN = 60 * S;
const HR = 60 * MIN;
const DAY = 24 * HR;

describe('splitCountdown', () => {
    it('splits a mixed duration into d/h/m/s', () => {
        const ms = 2 * DAY + 4 * HR + 37 * MIN + 12 * S;
        expect(splitCountdown(ms)).toEqual({ days: 2, hours: 4, minutes: 37, seconds: 12 });
    });

    it('clamps negatives to zero (event already started)', () => {
        expect(splitCountdown(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    });

    it('floors sub-second remainders', () => {
        expect(splitCountdown(1999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
    });

    it('rolls units at exact boundaries', () => {
        expect(splitCountdown(DAY)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0 });
        expect(splitCountdown(HR)).toEqual({ days: 0, hours: 1, minutes: 0, seconds: 0 });
    });
});

describe('pad2', () => {
    it('pads single digits and leaves two-digit numbers alone', () => {
        expect(pad2(0)).toBe('00');
        expect(pad2(7)).toBe('07');
        expect(pad2(42)).toBe('42');
    });
});

describe('parseEventStart', () => {
    it('returns null without a date', () => {
        expect(parseEventStart(undefined, '10:00:00')).toBeNull();
    });

    it('returns null for an unparseable date', () => {
        expect(parseEventStart('not-a-date')).toBeNull();
    });

    it('parses a date with an explicit time', () => {
        const d = parseEventStart('2026-08-01', '14:30:00');
        expect(d).toBeInstanceOf(Date);
        expect(d?.getFullYear()).toBe(2026);
    });

    it('defaults to midnight when no time is given', () => {
        const d = parseEventStart('2026-08-01');
        expect(d).not.toBeNull();
        expect(d?.getHours()).toBe(0);
    });
});

describe('formatShortCountdown', () => {
    it('shows days + hours when a day or more remains', () => {
        expect(formatShortCountdown(2 * DAY + 4 * HR)).toBe('2d 4h');
    });

    it('shows hours + minutes under a day', () => {
        expect(formatShortCountdown(22 * HR + 57 * MIN)).toBe('22h 57m');
    });

    it('shows only minutes under an hour', () => {
        expect(formatShortCountdown(45 * MIN)).toBe('45m');
    });

    it('reads 0m at/after start', () => {
        expect(formatShortCountdown(0)).toBe('0m');
        expect(formatShortCountdown(-1000)).toBe('0m');
    });
});
