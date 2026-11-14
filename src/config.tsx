import React, { createContext, useState } from 'react';
import { Easing, ImageStyle, Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';

import {
    getScaledValue,
    isPlatformMacos,
    isPlatformIos,
    isPlatformTvos,
    isPlatformWeb,
    isPlatformAndroidwear,
} from '@rnv/renative';
import CONFIG from '../platformAssets/renative.runtime.json';
import '../platformAssets/runtime/fontManager';
import ICON_LOGO from '../platformAssets/runtime/logo.png';
import { alpha, fontFamilies, gradientTokens, motion, palette, radii, spacing } from './config/tokens';

export function testProps(testId: string | undefined) {
    if (!testId) {
        return;
    }
    const isApplePlatform = isPlatformIos || isPlatformTvos || isPlatformMacos;
    if (isApplePlatform || isPlatformWeb) {
        return { testID: testId };
    }
    return { accessibilityLabel: testId, accessible: true };
}
const getFlexShrinkPropertyValue = () => {
    return isPlatformAndroidwear ? 0 : 1;
};
if (!global.performance) {
    // @ts-expect-error Performance needs to be typed
    global.performance = {};
}

if (typeof global.performance.now !== 'function') {
    global.performance.now = function () {
        const performanceNow = global.nativePerformanceNow || Date.now;
        return performanceNow();
    };
}

// Connekyt brand tokens. The values come from ./config/tokens, which mirrors the phone app's
// Midnight Glass palette (connekt-mobile src/theme), so phone and TV share one set of colours.
const isWebEngine = Platform.OS === 'web';

/** The typeface for each role on this engine. See fontFamilies in ./config/tokens. */
export const fonts = isWebEngine
    ? {
          body: fontFamilies.web.body,
          bodyMedium: fontFamilies.web.body,
          bodySemibold: fontFamilies.web.body,
          display: fontFamilies.web.display,
          displayMedium: fontFamilies.web.display,
      }
    : { ...fontFamilies.native };

export { palette, gradientTokens, radii, spacing, motion, alpha };

/** Midnight Glass motion curve for Animated on native. */
export const motionEasing = Easing.bezier(...motion.bezier);

const staticTheme = {
    primaryFontFamily: fonts.body,
    displayFontFamily: fonts.display,
    iconSize: getScaledValue(20),
    buttonSize: getScaledValue(30),
    colorLight: palette.white,
    colorBrand: palette.primary,
    colorBrandDark: palette.primaryDark,
    colorBrandNavy: palette.navy,
    colorPrimaryLight: palette.primaryLight,
    colorLive: palette.live,
    colorLiveGlow: palette.liveGlow,
    colorAccent: palette.accent,
    colorAccentLight: palette.accentLight,
    colorFocusRing: palette.primaryLight,
    colorSuccess: palette.success,
    colorWarning: palette.warning,
    colorError: palette.error,
    colorInfo: palette.info,
    colorLink: palette.link,
    colorActive: palette.active,
    colorActiveBg: palette.activeBg,
    colorPending: palette.pending,
    colorPendingBg: palette.pendingBg,
};

export const gradients = {
    brand: gradientTokens.brand,
    primary: gradientTokens.raisedPrimary,
    live: gradientTokens.raisedLive,
    accent: gradientTokens.raisedAccent,
    overlay: gradientTokens.overlay,
};

const staticThemes = {
    // Cinematic dark theme, the phone's Midnight Glass. Near-black rather than pure black.
    dark: {
        colorBgPrimary: palette.background,
        // The TV has always called the phone's `card` step "surface"; `colorSurfaceBase` is the
        // phone's `surface`, one step darker.
        colorSurface: palette.card,
        colorSurfaceBase: palette.surface,
        colorSurfaceMuted: palette.surfaceMuted,
        colorElevated: palette.elevated,
        colorTextPrimary: palette.text,
        colorTextSoft: palette.textSoft,
        colorTextSecondary: palette.textMuted,
        colorBorder: palette.border,
        colorBorderSoft: palette.borderSoft,
        glassTop: palette.glassTop,
        glassBottom: palette.glassBottom,
        glassSolid: palette.glassSolid,
        glassStroke: palette.glassStroke,
        glassHighlight: palette.glassHighlight,
        glassWell: palette.glassWell,
        ...staticTheme,
    },
    light: {
        colorBgPrimary: '#F4F6FB',
        colorSurface: '#FFFFFF',
        colorSurfaceBase: '#F4F6FB',
        colorSurfaceMuted: '#E9EAEE',
        colorElevated: '#FFFFFF',
        colorTextPrimary: '#0B1626',
        colorTextSoft: '#1F2A40',
        colorTextSecondary: '#33415C',
        colorBorder: '#D4D6DC',
        colorBorderSoft: '#E6E7EC',
        glassTop: 'rgba(255,255,255,0.82)',
        glassBottom: 'rgba(255,255,255,0.66)',
        glassSolid: '#FFFFFF',
        glassStroke: 'rgba(8,58,133,0.12)',
        glassHighlight: 'rgba(255,255,255,0.9)',
        glassWell: 'rgba(8,58,133,0.06)',
        ...staticTheme,
    },
};

const createStyleSheet = (currentTheme) =>
    StyleSheet.create({
        wrapper: {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            backgroundColor: currentTheme.colorBgPrimary,
            justifyContent: 'center',
            display: 'flex',
            alignItems: 'center',
        },
        scrollView: {
            flexGrow: 0,
            width: '100%',
        },
        container: {
            flexShrink: getFlexShrinkPropertyValue(),
            alignItems: 'center',
            paddingVertical: getScaledValue(10),
            minHeight: 'auto',
            alignSelf: 'stretch',
            backgroundColor: currentTheme.colorBgPrimary,
        },
        textH2: {
            fontFamily: currentTheme.displayFontFamily,
            fontSize: getScaledValue(20),
            marginHorizontal: getScaledValue(20),
            color: currentTheme.colorTextPrimary,
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
        },
        textH3: {
            fontFamily: currentTheme.primaryFontFamily,
            fontSize: getScaledValue(15),
            marginHorizontal: getScaledValue(20),
            marginTop: getScaledValue(5),
            color: currentTheme.colorTextSecondary,
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
        },
        image: {
            marginBottom: getScaledValue(30),
            width: getScaledValue(93),
            height: getScaledValue(90),
        },
        button: {
            margin: 10,
            padding: 10,
            backgroundColor: currentTheme.colorBrand,
            borderRadius: radii.sm,
            outline: 'none',
        } as CustomStyleView,
        focusedButton: {
            opacity: 1,
            borderWidth: 2,
            borderColor: currentTheme.colorFocusRing,
            transform: [{ scale: 1.05 }],
        } as CustomStyleView,
        buttonText: {
            fontFamily: currentTheme.displayFontFamily,
            fontSize: getScaledValue(15),
            color: currentTheme.colorLight,
        },
    });

const themes = {
    light: {
        static: { ...staticThemes.light },
        styles: createStyleSheet(staticThemes.light),
    },
    dark: {
        static: { ...staticThemes.dark },
        styles: createStyleSheet(staticThemes.dark),
    },
};

export type CustomStyleView = ViewStyle & { outline?: string };
export type ThemeInterface = {
    theme: {
        static: {
            primaryFontFamily: string;
            displayFontFamily: string;
            iconSize: number;
            buttonSize: number;
            colorLight: string;
            colorBrand: string;
            colorBrandDark: string;
            colorBrandNavy: string;
            colorPrimaryLight: string;
            colorLive: string;
            colorLiveGlow: string;
            colorAccent: string;
            colorAccentLight: string;
            colorFocusRing: string;
            colorSuccess: string;
            colorWarning: string;
            colorError: string;
            colorInfo: string;
            colorLink: string;
            colorActive: string;
            colorActiveBg: string;
            colorPending: string;
            colorPendingBg: string;
            colorBgPrimary: string;
            colorSurface: string;
            colorSurfaceBase: string;
            colorElevated: string;
            colorTextSoft: string;
            colorSurfaceMuted: string;
            colorTextPrimary: string;
            colorTextSecondary: string;
            colorBorder: string;
            colorBorderSoft: string;
            glassTop: string;
            glassBottom: string;
            glassSolid: string;
            glassStroke: string;
            glassHighlight: string;
            glassWell: string;
        };
        styles: {
            wrapper: ViewStyle;
            container: ViewStyle;
            textH2: TextStyle;
            textH3: TextStyle;
            image: ImageStyle;
            button: CustomStyleView;
            focusedButton: CustomStyleView;
            buttonText: TextStyle;
            scrollView: ViewStyle;
        };
    };
    dark: boolean;
    toggle: () => void;
};

export const ThemeContext = createContext<ThemeInterface>({
    dark: false,
    toggle: () => {
        //Do nothing by default
    },
    theme: themes.dark,
});

export function ThemeProvider({ children }) {
    // This is a 10-foot cinematic TV experience — dark is the real theme,
    // not an opt-in toggle. (Previously defaulted to light, which is why
    // the app was rendering white/light despite every screen being built
    // against the dark palette.)
    const [dark, setDark] = useState(true);

    const toggle = () => {
        const isDark = !dark;
        setDark(isDark);
    };

    const theme = dark ? themes.dark : themes.light;

    return <ThemeContext.Provider value={{ theme, dark, toggle }}>{children}</ThemeContext.Provider>;
}

export const themeStyles = themes.dark.styles;

export { CONFIG, ICON_LOGO };

export default staticThemes.dark;
