import { fontFamilies } from './tokens';

/**
 * Which typeface a piece of text belongs to. `body` is Inter (copy, captions, metadata),
 * `display` is Space Grotesk (headings, titles, big numbers, button labels).
 */
export type FontVariant = 'body' | 'display';

/** The fontWeight values React Native accepts, plus the absence of one. */
export type FontWeightInput =
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900'
    | number
    | undefined
    | null;

export type ResolvedFont = {
    fontFamily: string;
    /** Left undefined on native engines: the family already names the weight file. */
    fontWeight?: FontWeightInput;
};

/** The numeric weight a fontWeight value stands for; no weight means regular (400). */
export function numericWeight(weight: FontWeightInput): number {
    if (weight === undefined || weight === null || weight === 'normal') return 400;
    if (weight === 'bold') return 700;
    const n = typeof weight === 'number' ? weight : parseInt(weight, 10);
    return Number.isFinite(n) ? n : 400;
}

/**
 * The fontFamily (and fontWeight) a Text should carry for a given weight and role.
 *
 * Native engines (Android TV, tvOS) only use a bundled font when the Text names its file, and
 * Android fakes a bold on top of a named face when fontWeight is also set, so on native this names
 * the exact file for the weight and returns no fontWeight. Only five files ship: Inter 400, 500
 * and 600, Space Grotesk 600 and 700, so lighter weights round up and heavier ones round down to
 * the nearest file.
 *
 * The web engines keep the existing behaviour: the CSS family `Connekyt` maps the weight to a file
 * (see src/styles/fonts.css), so the weight is passed through untouched.
 */
export function resolveFont({
    weight,
    variant = 'body',
    platform,
}: {
    weight?: FontWeightInput;
    variant?: FontVariant;
    platform: string;
}): ResolvedFont {
    if (platform === 'web') {
        return {
            fontFamily: variant === 'display' ? fontFamilies.web.display : fontFamilies.web.body,
            fontWeight: weight ?? undefined,
        };
    }
    const n = numericWeight(weight);
    if (variant === 'display') {
        return { fontFamily: n >= 700 ? fontFamilies.native.display : fontFamilies.native.displayMedium };
    }
    if (n >= 600) return { fontFamily: fontFamilies.native.bodySemibold };
    if (n >= 500) return { fontFamily: fontFamilies.native.bodyMedium };
    return { fontFamily: fontFamilies.native.body };
}
