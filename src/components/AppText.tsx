import React, { createContext, forwardRef, useContext } from 'react';
import { Platform, StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { FontVariant, resolveFont } from '../config/fontResolve';

export type AppTextProps = TextProps & {
    /** `display` for headings, titles, big numbers and button labels; `body` (the default) for copy. */
    variant?: FontVariant;
};

/** True inside another AppText, so a nested span with no weight or variant of its own inherits the parent's face. */
const NestedText = createContext(false);

/**
 * The one Text the app renders. It names the bundled font file for the style's fontWeight and the
 * variant, because Android TV ignores a custom font unless the Text names it, and drops fontWeight
 * on native so Android does not fake a bold over the named face. See resolveFont.
 */
export const AppText = forwardRef<Text, AppTextProps>(function AppText({ variant, style, children, ...rest }, ref) {
    const nested = useContext(NestedText);
    const flat: TextStyle = StyleSheet.flatten(style) || {};

    let resolvedStyle: TextStyle = flat;
    if (!(nested && variant === undefined && flat.fontWeight === undefined)) {
        const font = resolveFont({ weight: flat.fontWeight, variant, platform: Platform.OS });
        resolvedStyle = { ...flat, fontFamily: font.fontFamily };
        if (font.fontWeight === undefined) {
            delete resolvedStyle.fontWeight;
        } else {
            resolvedStyle.fontWeight = font.fontWeight as TextStyle['fontWeight'];
        }
    }

    return (
        <Text ref={ref} {...rest} style={resolvedStyle}>
            {nested ? children : <NestedText.Provider value>{children}</NestedText.Provider>}
        </Text>
    );
});

export default AppText;
