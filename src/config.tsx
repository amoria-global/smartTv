import React, { createContext, useState } from 'react';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';

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

// Connekyt brand tokens (mirrors connekt-mobile/src/theme/index.ts) — same
// primary blue / accent pink across web, mobile, and this TV app.
const staticTheme = {
    primaryFontFamily: "'Pragati Narrow', sans-serif",
    iconSize: getScaledValue(20),
    buttonSize: getScaledValue(30),
    colorLight: '#FFFFFF',
    colorBrand: '#3E6FD8',
    colorBrandDark: '#2F59B8',
    colorBrandNavy: '#083A85',
    colorPrimaryLight: '#5B8CFF',
    colorLive: '#FF0033',
    colorLiveGlow: 'rgba(255,0,51,0.55)',
    colorAccent: '#F20C8F',
    colorAccentLight: '#ff4fae',
    colorFocusRing: '#F20C8F',
    colorSuccess: '#34D399',
    colorWarning: '#FBBF24',
    colorError: '#F87171',
    colorInfo: '#60A5FA',
};

export const gradients = {
    brand: ['#083A85', '#F20C8F'] as const,
    primary: ['#5B8CFF', '#3E6FD8', '#2F59B8'] as const,
    live: ['#FF2D55', '#FF0033', '#C8001F'] as const,
    accent: ['#F20C8F', '#ff4fae'] as const,
    // Bottom-up scrim used behind hero banner text/controls.
    overlay: ['rgba(10,18,32,0)', 'rgba(10,18,32,0.85)', '#0A1220'] as const,
};

const staticThemes = {
    // Cinematic dark theme — near-black rather than pure black, matching a
    // 10-foot Netflix-style TV experience.
    dark: {
        colorBgPrimary: '#0A1220',
        colorSurface: '#16243C',
        colorSurfaceMuted: '#1B2B46',
        colorTextPrimary: '#EAF0FA',
        colorTextSecondary: '#93A3BE',
        colorBorder: '#2A3B58',
        colorBorderSoft: '#1E2D47',
        glassTop: 'rgba(32,50,82,0.62)',
        glassBottom: 'rgba(18,30,52,0.52)',
        glassSolid: '#16243C',
        glassStroke: 'rgba(170,195,240,0.14)',
        glassHighlight: 'rgba(255,255,255,0.16)',
        glassWell: 'rgba(4,9,18,0.55)',
        ...staticTheme,
    },
    light: {
        colorBgPrimary: '#F4F6FB',
        colorSurface: '#FFFFFF',
        colorSurfaceMuted: '#E9EAEE',
        colorTextPrimary: '#0B1626',
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
            fontFamily: currentTheme.primaryFontFamily,
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
            borderRadius: 10,
            outline: 'none',
        } as CustomStyleView,
        focusedButton: {
            opacity: 1,
            borderWidth: 2,
            borderColor: currentTheme.colorFocusRing,
            transform: [{ scale: 1.05 }],
        } as CustomStyleView,
        buttonText: {
            fontFamily: currentTheme.primaryFontFamily,
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
            colorBgPrimary: string;
            colorSurface: string;
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
