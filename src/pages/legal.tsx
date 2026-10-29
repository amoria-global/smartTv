import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { midnightGlass } from '../components/glass/glassStyle';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext } from '../config';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { useFocusNav } from '../hooks/useFocusNav';
import { useBackHandler } from '../hooks/useBackHandler';
import { useTranslation } from '../i18n';
import {
    LEGAL_LAST_UPDATED,
    LEGAL_PRIVACY_URL,
    LEGAL_TERMS_URL,
    PRIVACY_SECTIONS,
    TERMS_SECTIONS,
    LegalSection,
} from '../features/legal/content';

type DocKey = 'privacy' | 'terms';

export default function LegalScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();

    // Which document to open is driven by ?doc=privacy|terms (defaults to privacy).
    const initial: DocKey = router.query.doc === 'terms' ? 'terms' : 'privacy';
    const [doc, setDoc] = useState<DocKey>(initial);

    // Next.js populates router.query only after the first client render, so a
    // deep link like /legal?doc=terms needs a sync once the query is ready.
    // Tab clicks use setDoc directly and aren't affected (they don't change the URL).
    useEffect(() => {
        if (router.query.doc === 'terms') setDoc('terms');
        else if (router.query.doc === 'privacy') setDoc('privacy');
    }, [router.query.doc]);

    // Back returns to wherever the user came from (Settings, usually).
    useBackHandler(() => {
        if (window.history.length > 1) router.back();
        else router.push('/settings');
    }, true);

    const isPrivacy = doc === 'privacy';
    const sections: LegalSection[] = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
    const webUrl = isPrivacy ? LEGAL_PRIVACY_URL : LEGAL_TERMS_URL;
    const title = isPrivacy ? strings.legal.privacyTitle : strings.legal.termsTitle;

    const readingTime = useMemo(() => {
        const words = sections.reduce((n, s) => n + s.body.split(/\s+/).length, 0);
        return Math.max(1, Math.round(words / 200));
    }, [sections]);

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <View style={styles.body}>
                {/* Left rail: back + document switcher */}
                <View style={[styles.sidebar, { borderRightColor: theme.static.colorBorder }]}>
                    <TouchableOpacity onPress={() => router.push('/settings')} style={styles.backRow}>
                        <i className="bi bi-arrow-left" style={{ fontSize: 18, color: theme.static.colorTextPrimary }} />
                        <Text style={[styles.backText, { color: theme.static.colorTextPrimary }]}>{strings.legal.backToSettings}</Text>
                    </TouchableOpacity>

                    <Text style={[styles.railHeading, { color: theme.static.colorTextSecondary }]}>{strings.settings.legalHeader}</Text>

                    <DocTab
                        icon="bi-shield-check"
                        label={strings.legal.privacyTitle}
                        active={isPrivacy}
                        hasTVPreferredFocus
                        onPress={() => setDoc('privacy')}
                    />
                    <DocTab
                        icon="bi-file-earmark-text"
                        label={strings.legal.termsTitle}
                        active={!isPrivacy}
                        onPress={() => setDoc('terms')}
                    />

                    <View style={styles.railSpacer} />

                    {/* QR to the canonical web version */}
                    <View style={[styles.qrCard, styles.glass]}>
                        <View style={styles.qrBox}>
                            <QRCodeSVG value={webUrl} size={116} bgColor="#FFFFFF" fgColor="#0B0B10" level="M" />
                        </View>
                        <Text style={[styles.qrCaption, { color: theme.static.colorTextSecondary }]}>{strings.legal.scanCaption}</Text>
                    </View>
                </View>

                {/* Reader */}
                <ScrollView style={styles.reader} contentContainerStyle={styles.readerInner} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.docTitle, { color: theme.static.colorTextPrimary }]}>{title}</Text>
                    <Text style={[styles.docMeta, { color: theme.static.colorTextSecondary }]}>
                        {strings.legal.lastUpdatedPrefix} {LEGAL_LAST_UPDATED} · {readingTime} {strings.legal.minRead}
                    </Text>

                    <View style={[styles.docCard, styles.glass]}>
                        {sections.map((s, i) => (
                            <View key={s.heading} style={i > 0 ? styles.sectionSpacing : undefined}>
                                <Text style={[styles.sectionHeading, { color: theme.static.colorTextPrimary }]}>{s.heading}</Text>
                                <Text style={[styles.sectionBody, { color: theme.static.colorTextSecondary }]}>{s.body}</Text>
                            </View>
                        ))}

                        <View style={[styles.canonicalNote, { borderTopColor: theme.static.colorBorder }]}>
                            <i className="bi bi-info-circle" style={{ fontSize: 15, color: theme.static.colorAccent }} />
                            <Text style={[styles.canonicalText, { color: theme.static.colorTextSecondary }]}>{strings.legal.canonicalNote}</Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </ScreenWrapper>
    );
}

function DocTab({
    icon,
    label,
    active,
    onPress,
    hasTVPreferredFocus,
}: {
    icon: string;
    label: string;
    active: boolean;
    onPress: () => void;
    hasTVPreferredFocus?: boolean;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            hasTVPreferredFocus={hasTVPreferredFocus}
            {...focusProps}
            style={[
                styles.docTab,
                active && { backgroundColor: 'rgba(242, 12, 143, 0.14)' },
                focused && { backgroundColor: theme.static.colorFocusRing },
            ]}
        >
            <i
                className={`bi ${icon}`}
                style={{ fontSize: 16, color: focused ? '#fff' : active ? theme.static.colorAccent : theme.static.colorTextSecondary }}
            />
            <Text
                style={[
                    styles.docTabText,
                    { color: focused ? '#fff' : active ? theme.static.colorTextPrimary : theme.static.colorTextSecondary },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    body: { flex: 1, flexDirection: 'row' },

    sidebar: {
        width: 320,
        paddingVertical: 32,
        paddingHorizontal: 20,
        borderRightWidth: 1,
        gap: 6,
    },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, marginBottom: 20 },
    backText: { fontSize: 15, fontWeight: '600' },
    railHeading: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 8 },
    docTab: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10 },
    docTabText: { fontSize: 15, fontWeight: '600' },
    railSpacer: { flex: 1 },

    qrCard: { borderRadius: 16, padding: 18, alignItems: 'center', gap: 12 },
    qrBox: { width: 132, height: 132, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 8 },
    qrCaption: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

    reader: { flex: 1 },
    readerInner: { padding: 48, paddingTop: 40, paddingBottom: 80, maxWidth: 1040 },
    docTitle: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
    docMeta: { fontSize: 14, marginBottom: 28 },

    docCard: { borderRadius: 18, padding: 36 },
    sectionSpacing: { marginTop: 28 },
    sectionHeading: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
    sectionBody: { fontSize: 16, lineHeight: 26 },

    canonicalNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 32, paddingTop: 24, borderTopWidth: 1 },
    canonicalText: { flex: 1, fontSize: 14, lineHeight: 20 },

    glass: midnightGlass as object,
});
