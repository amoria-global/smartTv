import { describe, expect, it } from 'vitest';
import { numericWeight, resolveFont } from './fontResolve';
import { fontFamilies } from './tokens';

// The bundled .ttf base names in appConfigs/base/fonts. Android only finds a font by its exact file name.
const INTER_400 = 'Inter_400Regular';
const INTER_500 = 'Inter_500Medium';
const INTER_600 = 'Inter_600SemiBold';
const GROTESK_600 = 'SpaceGrotesk_600SemiBold';
const GROTESK_700 = 'SpaceGrotesk_700Bold';

describe('numericWeight', () => {
    it('reads every form React Native accepts', () => {
        expect(numericWeight(undefined)).toBe(400);
        expect(numericWeight(null)).toBe(400);
        expect(numericWeight('normal')).toBe(400);
        expect(numericWeight('bold')).toBe(700);
        expect(numericWeight('500')).toBe(500);
        expect(numericWeight(600)).toBe(600);
    });
});

describe('resolveFont on native', () => {
    for (const platform of ['android', 'ios']) {
        const body: Array<[Parameters<typeof resolveFont>[0]['weight'], string]> = [
            [undefined, INTER_400],
            ['normal', INTER_400],
            ['100', INTER_400],
            ['200', INTER_400],
            ['300', INTER_400],
            ['400', INTER_400],
            ['500', INTER_500],
            ['600', INTER_600],
            ['700', INTER_600],
            ['bold', INTER_600],
            ['800', INTER_600],
            ['900', INTER_600],
        ];
        const display: Array<[Parameters<typeof resolveFont>[0]['weight'], string]> = [
            [undefined, GROTESK_600],
            ['normal', GROTESK_600],
            ['100', GROTESK_600],
            ['300', GROTESK_600],
            ['400', GROTESK_600],
            ['500', GROTESK_600],
            ['600', GROTESK_600],
            ['700', GROTESK_700],
            ['bold', GROTESK_700],
            ['800', GROTESK_700],
            ['900', GROTESK_700],
        ];

        it.each(body)(`${platform} body weight %s names %s and sets no fontWeight`, (weight, file) => {
            const font = resolveFont({ weight, variant: 'body', platform });
            expect(font).toEqual({ fontFamily: file });
            expect('fontWeight' in font).toBe(false);
        });

        it.each(display)(`${platform} display weight %s names %s and sets no fontWeight`, (weight, file) => {
            const font = resolveFont({ weight, variant: 'display', platform });
            expect(font).toEqual({ fontFamily: file });
            expect('fontWeight' in font).toBe(false);
        });
    }

    it('defaults to the body variant', () => {
        expect(resolveFont({ weight: '500', platform: 'android' })).toEqual({ fontFamily: INTER_500 });
    });

    it('only ever names a file the app bundles', () => {
        const bundled = new Set(Object.values(fontFamilies.native));
        for (const variant of ['body', 'display'] as const) {
            for (const weight of ['100', '400', '500', '600', '700', '900'] as const) {
                expect(bundled.has(resolveFont({ weight, variant, platform: 'android' }).fontFamily as never)).toBe(true);
            }
        }
    });
});

describe('resolveFont on web', () => {
    const weights = [undefined, 'normal', 'bold', '100', '400', '500', '600', '700', '800', '900'] as const;

    it.each(weights)('body weight %s uses the Connekyt stack and keeps the weight', (weight) => {
        expect(resolveFont({ weight, variant: 'body', platform: 'web' })).toEqual({
            fontFamily: fontFamilies.web.body,
            fontWeight: weight,
        });
    });

    it.each(weights)('display weight %s uses the Connekyt stack and keeps the weight', (weight) => {
        expect(resolveFont({ weight, variant: 'display', platform: 'web' })).toEqual({
            fontFamily: fontFamilies.web.display,
            fontWeight: weight,
        });
    });

    it('leads with the Connekyt family so fonts.css picks the face by weight', () => {
        expect(resolveFont({ platform: 'web' }).fontFamily.startsWith("'Connekyt'")).toBe(true);
        expect(resolveFont({ variant: 'display', platform: 'web' }).fontFamily.startsWith("'Connekyt'")).toBe(true);
    });
});
