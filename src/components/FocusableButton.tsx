import React, { useContext } from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';

type Props = {
    title: string;
    onPress: () => void;
    hasTVPreferredFocus?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
};

export function FocusableButton({ title, onPress, hasTVPreferredFocus, disabled, style, textStyle }: Props) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();

    return (
        <TouchableOpacity
            onPress={onPress}
            hasTVPreferredFocus={hasTVPreferredFocus}
            disabled={disabled}
            {...focusProps}
            style={[
                styles.button,
                { backgroundColor: theme.static.colorSurface, borderColor: theme.static.colorBorder },
                style,
                focused && { backgroundColor: theme.static.colorBrand, borderColor: theme.static.colorFocusRing, transform: [{ scale: 1.05 }] },
                disabled && { opacity: 0.5 },
            ]}
        >
            <Text style={[styles.text, { color: theme.static.colorTextPrimary }, textStyle, focused && { color: '#fff' }]}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: 9999,
        borderWidth: 2,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
    },
});
