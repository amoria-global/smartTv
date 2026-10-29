import React, { useContext, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { midnightGlass } from './glass/glassStyle';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { useBackHandler } from '../hooks/useBackHandler';
import { useTranslation, LOCALES } from '../i18n';

/** Flag + language-code trigger that opens a dropdown of every supported
 *  locale. Originally lived only inside Navbar (so only reachable once
 *  logged in) — pulled out so Login and Profiles (both pre-auth, no Navbar)
 *  can offer it too. Dropdown opens right-aligned to its own trigger, so
 *  drop this in a top-right corner same as the navbar usage. */
export function LanguageSwitcher() {
    const { theme } = useContext(ThemeContext);
    const { locale, setLocale } = useTranslation();
    const { focused, focusProps } = useFocusNav();
    const [open, setOpen] = useState(false);
    const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

    // Back key closes the language dropdown instead of navigating away.
    useBackHandler(() => setOpen(false), open);

    return (
        <View>
            <TouchableOpacity
                onPress={() => setOpen((v) => !v)}
                {...focusProps}
                style={[styles.langTrigger, focused && { backgroundColor: theme.static.colorFocusRing }]}
            >
                <i className="bi bi-globe2" style={{ fontSize: 15, color: focused ? '#fff' : theme.static.colorTextPrimary }} />
                <Text style={[styles.langTriggerText, { color: focused ? '#fff' : theme.static.colorTextPrimary }]}>
                    {current.short}
                </Text>
            </TouchableOpacity>

            {open && (
                <View
                    style={[
                        styles.langMenu,
                        midnightGlass as object,
                    ]}
                >
                    {LOCALES.map((l) => (
                        <LanguageOption
                            key={l.code}
                            short={l.short}
                            label={l.label}
                            active={locale === l.code}
                            onPress={() => {
                                setLocale(l.code);
                                setOpen(false);
                            }}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

function LanguageOption({
    short,
    label,
    active,
    onPress,
}: {
    short: string;
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.langOption, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <View style={styles.langOptionLeft}>
                <i className="bi bi-globe2" style={{ fontSize: 16, color: focused ? '#fff' : theme.static.colorTextSecondary }} />
                <View>
                    <Text
                        style={[
                            styles.langOptionShort,
                            { color: focused ? '#fff' : active ? theme.static.colorTextPrimary : theme.static.colorTextSecondary },
                        ]}
                    >
                        {short}
                    </Text>
                    <Text
                        style={[
                            styles.langOptionText,
                            { color: focused ? 'rgba(255,255,255,0.75)' : theme.static.colorTextSecondary },
                        ]}
                    >
                        {label}
                    </Text>
                </View>
            </View>
            {active ? <i className="bi bi-check-lg" style={{ fontSize: 16, color: theme.static.colorAccent }} /> : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    langTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 36,
        borderRadius: 18,
        paddingHorizontal: 10,
    },
    langTriggerText: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 },
    langMenu: {
        position: 'absolute',
        top: 48,
        right: 0,
        minWidth: 200,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 6,
        zIndex: 20,
    } as object,
    langOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 14,
        gap: 12,
    },
    langOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    langOptionShort: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
    langOptionText: { fontSize: 12, fontWeight: '500' },
});
