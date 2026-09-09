import React, { useContext, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext, ICON_LOGO } from '../config';
import { storage, StorageKeys } from '../services/storage';
import { useTranslation } from '../i18n';

const SLIDE_ICONS = ['bi-broadcast', 'bi-qr-code-scan'];

const PRIVACY_URL = 'https://connekyt.com/user/privacy-policy';
const TERMS_URL = 'https://connekyt.com/user/terms-of-service';

// Persisted (unlike connekt-mobile's every-launch onboarding) — a shared
// living-room TV re-showing this every time someone turns it on would get
// old fast. Flip to "always show" by skipping the storage check in
// splash.tsx if you'd rather match mobile's behavior exactly.
async function markSeen() {
    await storage.set(StorageKeys.onboardingSeen, 'true');
}

export default function OnboardingScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const [index, setIndex] = useState(0);

    // TV-specific value props (not a 1:1 port of connekt-mobile's 4-slide
    // intro — this leans into what matters on the big screen: live viewing
    // and the QR sign-in flow this app actually has). Same backdrop as login
    // on every slide; each slide's icon is what differentiates it.
    const slides = [
        { icon: SLIDE_ICONS[0], title: strings.onboarding.slide1Title, body: strings.onboarding.slide1Body },
        { icon: SLIDE_ICONS[1], title: strings.onboarding.slide2Title, body: strings.onboarding.slide2Body },
    ];
    const isLast = index === slides.length - 1;
    const slide = slides[index];

    const finish = async () => {
        await markSeen();
        router.replace('/login');
    };

    const next = () => {
        if (isLast) {
            finish();
        } else {
            setIndex((i) => i + 1);
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: theme.static.colorBgPrimary }]}>
            <Image source={{ uri: '/images/login.png' }} style={StyleSheet.absoluteFillObject} blurRadius={18} />
            <View style={[styles.scrim, { backgroundColor: theme.static.colorBgPrimary }]} />

            <TopBar onSignIn={finish} />

            <View style={styles.content}>
                <View style={styles.iconBadge}>
                    <i className={`bi ${slide.icon}`} style={{ fontSize: 40, color: theme.static.colorAccent }} />
                </View>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>
            </View>

            <View style={styles.footer}>
                <View style={styles.dots}>
                    {slides.map((s, i) => (
                        <View
                            key={s.title}
                            style={[
                                styles.dot,
                                i === index && { width: 26, backgroundColor: theme.static.colorAccent },
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity onPress={next} hasTVPreferredFocus style={[styles.cta, { backgroundColor: theme.static.colorAccent }]}>
                    <Text style={styles.ctaText}>{strings.onboarding.getStarted}</Text>
                </TouchableOpacity>

                <View style={styles.legalRow}>
                    <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                        <Text style={styles.legalText}>{strings.onboarding.privacy}</Text>
                    </TouchableOpacity>
                    <Text style={styles.legalDot}>·</Text>
                    <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                        <Text style={styles.legalText}>{strings.onboarding.terms}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// Trimmed to just brand + Sign In — Privacy/Terms/Language moved to small
// print in the footer (or Settings) instead of competing for attention on
// the very first screen someone ever sees, which is more how TV apps
// actually handle legal/language chrome.
function TopBar({ onSignIn }: { onSignIn: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    return (
        <View style={styles.topBar}>
            <View style={styles.brandRow}>
                <Image source={ICON_LOGO} style={styles.logo} resizeMode="contain" />
                <Text style={[styles.brandText, { color: theme.static.colorTextPrimary }]}>Connekyt</Text>
            </View>
            <TouchableOpacity onPress={onSignIn} style={styles.signInButton}>
                <Text style={styles.signInText}>{strings.onboarding.signIn}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        minHeight: '100vh',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 64,
    } as object,
    scrim: { ...StyleSheet.absoluteFillObject, opacity: 0.55 } as object,
    topBar: {
        position: 'absolute',
        top: 24,
        left: 24,
        right: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 26,
        backgroundColor: 'rgba(21, 21, 28, 0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.10)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
    } as object,
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logo: { width: 28, height: 28 },
    brandText: { fontSize: 18, fontWeight: '800' },
    signInButton: {
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 999,
    },
    signInText: { color: '#083A85', fontSize: 14, fontWeight: '800' },
    content: { alignItems: 'center', maxWidth: 720 },
    iconBadge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    title: {
        color: '#fff',
        fontSize: 48,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 56,
        marginBottom: 18,
        textShadow: '0 2px 12px rgba(0,0,0,0.35)',
    } as object,
    body: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 26,
        maxWidth: 560,
    },
    footer: { position: 'absolute', bottom: 48, alignItems: 'center' },
    dots: { flexDirection: 'row', gap: 8, marginBottom: 28 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
    cta: {
        paddingVertical: 16,
        paddingHorizontal: 48,
        borderRadius: 9999,
        marginBottom: 24,
    },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    legalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legalText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
    legalDot: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
});
