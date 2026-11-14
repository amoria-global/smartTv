import { describe, expect, it } from 'vitest';
import { alpha, motion, palette, radii, spacing } from './tokens';

// The phone app's Midnight Glass values (connekt-mobile src/theme). If the phone changes, change both.
describe('Midnight Glass tokens match the phone', () => {
    it('uses the phone dark brand and status colours', () => {
        expect(palette.primary).toBe('#3E6FD8');
        expect(palette.primaryDark).toBe('#3360C4');
        expect(palette.accent).toBe('#EE0E8F');
        expect(palette.accentLight).toBe('#FF5DB8');
        expect(palette.success).toBe('#4ADE80');
        expect(palette.warning).toBe('#F5B400');
        expect(palette.info).toBe('#8FB4FF');
        expect(palette.error).toBe('#F87171');
    });

    it('has the surface and text roles the phone has', () => {
        expect(palette.background).toBe('#0A1220');
        expect(palette.surface).toBe('#101B2E');
        expect(palette.card).toBe('#16243C');
        expect(palette.elevated).toBe('#1D2F4D');
        expect(palette.textSoft).toBe('#C9D5EA');
        expect(palette.link).toBe('#7FA6F5');
        expect(palette.active).toBe('#22C7D9');
        expect(palette.activeBg).toBe('rgba(34,199,217,0.14)');
        expect(palette.pending).toBe('#F5B400');
        expect(palette.pendingBg).toBe('rgba(245,180,0,0.14)');
    });

    it('uses the phone radii, spacing and motion', () => {
        expect(radii).toEqual({ sm: 8, tile: 14, card: 20, panel: 24, hero: 28, pill: 999 });
        expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 24, 32, 48]);
        expect([motion.fast, motion.base, motion.slow]).toEqual([180, 220, 260]);
        expect(motion.css).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    });
});

describe('alpha', () => {
    it('turns a hex token into rgba', () => {
        expect(alpha('#3E6FD8', 0.5)).toBe('rgba(62,111,216,0.5)');
        expect(alpha('#fff', 0.2)).toBe('rgba(255,255,255,0.2)');
    });
});
