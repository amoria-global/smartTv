import { Platform, ViewStyle } from 'react-native';
import { alpha, gradientTokens, motion, palette, radii } from '../../config/tokens';

/**
 * Midnight Glass for the TV, the same look as the Connekyt phone app: frosted panels over a glowing scene,
 * raised (skeuomorphic) buttons with a lit top edge, and a red glow on anything live.
 *
 * The web and Tizen/webOS engines run CSS, so they get real blur, gradients and inset highlights. The native
 * TV engines (Android TV, tvOS) have no backdrop blur in React Native, so they fall back to the solid glass
 * colour with the same border and shadow. Nothing here depends on which engine is running.
 */
const isWeb = Platform.OS === 'web';

type Css = ViewStyle & Record<string, unknown>;

export type GlassTokens = {
    glassTop: string;
    glassBottom: string;
    glassSolid: string;
    glassStroke: string;
    glassHighlight: string;
    glassWell: string;
    colorBrand: string;
    colorPrimaryLight: string;
    colorBrandDark: string;
    colorAccent: string;
    colorLive: string;
    colorLiveGlow: string;
};

/** A frosted glass surface. `raised` adds depth for things the viewer can press. */
export function glassSurface(t: GlassTokens, opts: { radius?: number; raised?: boolean } = {}): Css {
    const radius = opts.radius ?? radii.card;
    const base: Css = {
        borderRadius: radius,
        borderWidth: 1,
        borderColor: t.glassStroke,
        overflow: 'hidden',
    };
    if (!isWeb) return { ...base, backgroundColor: t.glassSolid };
    return {
        ...base,
        backgroundColor: 'transparent',
        backgroundImage: `linear-gradient(180deg, ${t.glassTop}, ${t.glassBottom})`,
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        boxShadow: opts.raised
            ? `inset 0 1px 0 ${t.glassHighlight}, 0 14px 32px rgba(0,0,0,0.38)`
            : `inset 0 1px 0 ${t.glassHighlight}, 0 8px 22px rgba(0,0,0,0.28)`,
    };
}

/** A sunken well, for inputs and inner panels set into glass. */
export function glassWell(t: GlassTokens, radius: number = radii.tile): Css {
    return {
        borderRadius: radius,
        borderWidth: 1,
        borderColor: t.glassStroke,
        backgroundColor: t.glassWell,
        ...(isWeb ? { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)' } : {}),
    };
}

export type RaisedTone = 'primary' | 'accent' | 'live' | 'glass';

/** A raised button: lit top edge, a darker base and a soft drop shadow. Focus adds a glow ring and a lift. */
export function raisedButton(
    t: GlassTokens,
    tone: RaisedTone,
    state: { focused?: boolean; pressed?: boolean; disabled?: boolean } = {},
): Css {
    const fill =
        tone === 'primary' ? [t.colorPrimaryLight, t.colorBrand, t.colorBrandDark]
        : tone === 'accent' ? gradientTokens.raisedAccent
        : tone === 'live' ? gradientTokens.raisedLive
        : null;
    const glow = tone === 'live' ? t.colorLiveGlow : tone === 'accent' ? alpha(palette.accent, 0.55) : alpha(palette.primaryLight, 0.6);

    const style: Css = {
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: fill ? alpha(palette.white, 0.22) : t.glassStroke,
        opacity: state.disabled ? 0.5 : 1,
        transform: [{ scale: state.focused ? 1.06 : state.pressed ? 0.98 : 1 }],
    };

    if (!isWeb) {
        style.backgroundColor = fill ? fill[1] : t.glassSolid;
        if (state.focused) {
            style.borderColor = palette.white;
            style.borderWidth = 3;
        }
        return style;
    }

    style.backgroundImage = fill
        ? `linear-gradient(180deg, ${fill[0]} 0%, ${fill[1]} 55%, ${fill[2]} 100%)`
        : `linear-gradient(180deg, ${t.glassTop}, ${t.glassBottom})`;
    style.backgroundColor = 'transparent';
    if (!fill) {
        style.backdropFilter = 'blur(20px)';
        style.WebkitBackdropFilter = 'blur(20px)';
    }
    const lit = `inset 0 1px 0 rgba(255,255,255,${fill ? 0.38 : 0.2}), inset 0 -2px 0 rgba(0,0,0,0.22)`;
    style.boxShadow = state.focused
        ? `${lit}, 0 0 0 3px rgba(255,255,255,0.92), 0 0 34px 6px ${glow}, 0 16px 30px rgba(0,0,0,0.45)`
        : state.pressed
            ? `inset 0 3px 8px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3)`
            : `${lit}, 0 8px 18px rgba(0,0,0,0.38)`;
    style.transitionProperty = 'transform, box-shadow';
    style.transitionDuration = `${motion.fast}ms`;
    style.transitionTimingFunction = motion.css;
    return style;
}

/** The ring and glow a focused glass card shows when the remote lands on it. */
export function focusGlow(t: GlassTokens, focused: boolean, live = false): Css {
    if (!focused) return {};
    if (!isWeb) return { borderColor: palette.white, borderWidth: 3 };
    const glow = live ? t.colorLiveGlow : alpha(palette.primaryLight, 0.6);
    return {
        borderColor: 'rgba(255,255,255,0.9)',
        transform: [{ scale: 1.06 }],
        boxShadow: `0 0 0 3px rgba(255,255,255,0.9), 0 0 40px 8px ${glow}, 0 22px 40px rgba(0,0,0,0.5)`,
    };
}

/** CSS for the glowing scene behind every screen: three soft orbs on the midnight ground. */
export function sceneBackground(ground: string): Css {
    if (!isWeb) return { backgroundColor: ground };
    return {
        backgroundColor: ground,
        backgroundImage: [
            `radial-gradient(60% 50% at 12% 8%, ${alpha(palette.primary, 0.34)}, transparent 70%)`,
            `radial-gradient(45% 45% at 92% 18%, ${alpha(palette.accent, 0.2)}, transparent 70%)`,
            `radial-gradient(55% 50% at 70% 100%, ${alpha(palette.active, 0.16)}, transparent 70%)`,
        ].join(', '),
    };
}

/**
 * The glass fill for the many static `StyleSheet` blocks across the pages, which cannot read the theme at
 * definition time. The TV is always dark, so these are the dark Midnight Glass values.
 */
export const midnightGlass: Css = isWeb
    ? {
          backgroundColor: 'transparent',
          backgroundImage: `linear-gradient(180deg, ${palette.glassTop}, ${palette.glassBottom})`,
          borderWidth: 1,
          borderColor: palette.glassStroke,
          backdropFilter: 'blur(28px) saturate(150%)',
          WebkitBackdropFilter: 'blur(28px) saturate(150%)',
          boxShadow: `0 22px 54px rgba(0,0,0,0.42), inset 0 1px 0 ${palette.glassHighlight}`,
      }
    : { backgroundColor: palette.glassSolid, borderWidth: 1, borderColor: palette.glassStroke };
