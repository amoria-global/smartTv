import React, { useContext } from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { raisedButton, RaisedTone } from './glass/glassStyle';

type Props = {
    title: string;
    onPress: () => void;
    hasTVPreferredFocus?: boolean;
    disabled?: boolean;
    /** Glass by default. `primary` is the one main action on a screen, `accent` and `live` are for attention and live. */
    tone?: RaisedTone;
    style?: ViewStyle;
    textStyle?: TextStyle;
};

export function FocusableButton({ title, onPress, hasTVPreferredFocus, disabled, tone = 'glass', style, textStyle }: Props) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();

    return (
        <TouchableOpacity
            onPress={onPress}
            hasTVPreferredFocus={hasTVPreferredFocus}
            disabled={disabled}
            activeOpacity={0.9}
            {...focusProps}
            style={[styles.button, raisedButton(theme.static, tone, { focused, disabled }), style]}
        >
            <Text style={[styles.text, { color: tone === 'glass' ? theme.static.colorTextPrimary : '#FFFFFF' }, textStyle]}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});
