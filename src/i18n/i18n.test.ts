import { describe, it, expect } from 'vitest';
import en from './en';
import fr from './fr';
import rw from './rw';

/**
 * Every locale must mirror en's key structure exactly. A missing key ships an
 * "undefined" string on-screen (a store-review red flag); an extra key is dead
 * weight. TypeScript enforces this at compile time (fr/rw are typed as
 * `Strings`), but this test also catches it at runtime and pinpoints the path.
 */
function paths(obj: unknown, prefix = ''): string[] {
    if (obj === null || typeof obj !== 'object') return [prefix];
    if (Array.isArray(obj)) {
        // Arrays (e.g. login.steps) — compare length via an index path.
        return obj.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
    }
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        paths(v, prefix ? `${prefix}.${k}` : k),
    );
}

const enPaths = paths(en).sort();

describe('i18n locale parity', () => {
    it.each([
        ['fr', fr],
        ['rw', rw],
    ])('%s has exactly the same keys as en', (_name, locale) => {
        const localePaths = paths(locale).sort();
        const missing = enPaths.filter((p) => !localePaths.includes(p));
        const extra = localePaths.filter((p) => !enPaths.includes(p));
        expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it('the pay-gate strings we ship on the TV exist in every locale', () => {
        for (const locale of [en, fr, rw]) {
            expect(locale.player.payGateTitle).toBeTruthy();
            expect(locale.player.payGateSubtitle).toBeTruthy();
            expect(locale.player.payGateOptionCamera).toBeTruthy();
            expect(locale.player.payGateOptionApp).toBeTruthy();
        }
    });
});
