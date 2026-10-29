import React, { useContext, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { raisedButton } from './glass/glassStyle';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { useTranslation } from '../i18n';

// Focus/navigation note: the D-pad moves between keys by real spatial
// (geometric) arrow-key navigation — utils/spatialNavigation, initialised
// globally in _app.tsx — not just DOM Tab order. These keys are plain
// Touchables, so they participate automatically with no extra wiring; the
// row-major layout below simply happens to make the spatial picks intuitive.
const KEYBOARD_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '-', '_'],
];

const LETTER_PATTERN = /^[a-z]$/;

/** On-screen keyboard for any TextInput a remote (no physical keyboard) needs
 *  to type into — pass key presses straight through to the caller's own text
 *  state (BACKSPACE/SPACE are special, everything else is a literal char).
 *
 *  Shift is one-shot (like a phone keyboard, not caps-lock): pressing it
 *  capitalizes the next letter only, then turns itself back off. Necessary
 *  for typing anything that needs an uppercase character at all — passwords
 *  most of all, since there was previously no way to produce one. */
export function OnScreenKeyboard({ onKeyPress, onDone }: { onKeyPress: (key: string) => void; onDone: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const [shiftActive, setShiftActive] = useState(false);

    const pressKey = (k: string) => {
        const isLetter = LETTER_PATTERN.test(k);
        onKeyPress(isLetter && shiftActive ? k.toUpperCase() : k);
        if (isLetter && shiftActive) setShiftActive(false);
    };

    return (
        <View style={styles.keyboard}>
            {KEYBOARD_ROWS.map((row, i) => (
                <View key={i} style={styles.keyboardRow}>
                    {row.map((k) => (
                        <Key
                            key={k}
                            label={LETTER_PATTERN.test(k) && shiftActive ? k.toUpperCase() : k}
                            onPress={() => pressKey(k)}
                        />
                    ))}
                </View>
            ))}
            {/* Wider than the grid rows above on purpose — these are the four
                keys used the most (case toggle, delete, space, submit), sized
                by hand to add up to the same total row width instead of
                trailing off short and reading as a row missing keys. */}
            <View style={styles.keyboardRow}>
                <Key
                    label={strings.login.keyboardShift}
                    width={100}
                    onPress={() => setShiftActive((s) => !s)}
                    active={shiftActive}
                />
                <Key label={strings.login.keyboardBackspace} width={130} onPress={() => onKeyPress('BACKSPACE')} />
                <Key label={strings.login.keyboardSpace} width={200} onPress={() => onKeyPress('SPACE')} />
                <Key label={strings.login.keyboardDone} width={120} onPress={onDone} accent={theme.static.colorAccent} />
            </View>
        </View>
    );
}

function Key({
    label,
    onPress,
    width,
    accent,
    active,
}: {
    label: string;
    onPress: () => void;
    width?: number;
    accent?: string;
    active?: boolean;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    const isAccent = !!accent;
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[
                styles.key,
                width ? { minWidth: width } : null,
                raisedButton(theme.static, isAccent || active ? 'primary' : 'glass', { focused }),
            ]}
        >
            <Text style={[styles.keyText, { color: isAccent || active ? '#fff' : theme.static.colorTextPrimary }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    keyboard: { marginTop: 32, gap: 10 },
    keyboardRow: { flexDirection: 'row', gap: 10 },
    key: {
        minWidth: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    keyText: { fontSize: 16, fontWeight: '700' },
});
