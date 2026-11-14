/**
 * Midnight Glass tokens for the TV, copied value for value from the Connekyt phone app
 * (connekt-mobile src/theme/palettes.ts darkPalette, src/theme/index.ts radii and spacing,
 * src/theme/motion.ts). Keep the two in step: a viewer moving from phone to TV should see the
 * same blues, pinks, status colours and shapes.
 *
 * The TV keeps its own 10-foot type scale, so font sizes are not mirrored here.
 *
 * This file has no React Native imports so the vitest suite can pin the values.
 */

/** The phone's dark palette (Midnight Glass), the only scheme the TV ships. */
export const palette = {
    // Brand
    primary: '#3E6FD8',
    primaryDark: '#3360C4',
    primaryLight: '#5B8CFF',
    navy: '#083A85',
    accent: '#EE0E8F',
    accentLight: '#FF5DB8',
    /** Accent's deep end, the base of a raised pink button. */
    accentDeep: '#C20A72',
    link: '#7FA6F5',

    // Surfaces, four deliberate steps over the ground.
    background: '#0A1220',
    surface: '#101B2E',
    card: '#16243C',
    surfaceMuted: '#1B2B46',
    elevated: '#1D2F4D',

    // Text
    text: '#EAF0FA',
    textSoft: '#C9D5EA',
    textMuted: '#93A3BE',
    textOnPrimary: '#FFFFFF',
    white: '#FFFFFF',
    black: '#000000',

    // Lines
    border: '#2A3B58',
    borderSoft: '#1E2D47',

    // Tints and scrims
    tint: 'rgba(62,111,216,0.16)',
    tintAccent: 'rgba(238,14,143,0.15)',
    scrim: 'rgba(0,0,0,0.65)',

    // Status
    success: '#4ADE80',
    successBg: '#0E2F22',
    warning: '#F5B400',
    warningBg: '#33260A',
    error: '#F87171',
    errorBg: '#341A1D',
    info: '#8FB4FF',
    infoBg: '#14335E',
    active: '#22C7D9',
    activeBg: 'rgba(34,199,217,0.14)',
    pending: '#F5B400',
    pendingBg: 'rgba(245,180,0,0.14)',
    dangerFill: '#C2353F',

    // Live, only for an event that is on air right now.
    live: '#FF0033',
    liveHot: '#FF2D55',
    liveDeep: '#C8001F',
    liveText: '#FF8FA3',
    liveGlow: 'rgba(255,0,51,0.55)',

    // Glass
    glassTop: 'rgba(32,50,82,0.62)',
    glassBottom: 'rgba(18,30,52,0.52)',
    glassSolid: '#16243C',
    glassStroke: 'rgba(170,195,240,0.14)',
    glassHighlight: 'rgba(255,255,255,0.16)',
    glassWell: 'rgba(4,9,18,0.55)',
} as const;

/** The phone's dark gradients (gradientsFor('dark')). Stops run top to bottom. */
export const gradientTokens = {
    brand: ['#14346F', '#2B5AB8', '#D01B84'] as const,
    accent: ['#C40A75', '#F20C8F'] as const,
    wash: ['rgba(61,111,214,0.20)', 'rgba(242,12,143,0.14)'] as const,
    heroBlue: ['#173A8F', '#2A5FCC'] as const,
    /** Raised button fills. The magenta middle is darker than `accent` so white text reads (4.9:1). */
    raisedPrimary: ['#5B8CFF', '#3E6FD8', '#3360C4'] as const,
    raisedAccent: ['#F64BA8', '#D80C82', '#B0076F'] as const,
    raisedLive: ['#FF2D55', '#FF0033', '#C8001F'] as const,
    ring: ['#5B8CFF', '#EE0E8F'] as const,
    /** Bottom-up scrim behind hero banner text and controls. */
    overlay: ['rgba(10,18,32,0)', 'rgba(10,18,32,0.85)', '#0A1220'] as const,
} as const;

/** Midnight Glass radii: sm 8, tile 14, card 20, panel 24, hero 28, pill. */
export const radii = {
    sm: 8,
    tile: 14,
    card: 20,
    panel: 24,
    hero: 28,
    pill: 999,
} as const;

/** The phone's spacing steps. */
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
} as const;

/** Midnight Glass motion: 180 to 260ms on one ease-out curve. */
export const motion = {
    fast: 180,
    base: 220,
    slow: 260,
    stagger: 40,
    /** The curve as numbers, for Easing.bezier on native. */
    bezier: [0.2, 0.8, 0.2, 1] as const,
    /** The same curve for CSS transitions on the web engines. */
    css: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

/**
 * Typefaces. Space Grotesk carries headings, numbers and buttons, Inter carries body copy.
 *
 * On the web engines one CSS family, `Connekyt`, maps weights 400 and 500 to Inter and 600 and 700
 * to Space Grotesk (see src/styles/fonts.css), so every bold heading or button picks up Space
 * Grotesk without each Text naming a font. Native engines name the bundled file instead.
 */
export const fontFamilies = {
    web: {
        body: "'Connekyt', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "'Connekyt', 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    native: {
        body: 'Inter_400Regular',
        bodyMedium: 'Inter_500Medium',
        bodySemibold: 'Inter_600SemiBold',
        display: 'SpaceGrotesk_700Bold',
        displayMedium: 'SpaceGrotesk_600SemiBold',
    },
} as const;

/** `hex` (#RGB or #RRGGBB) at the given opacity, for glows and tints built from a token. */
export function alpha(hex: string, opacity: number): string {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${opacity})`;
}
