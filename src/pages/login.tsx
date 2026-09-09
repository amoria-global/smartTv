import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext, ICON_LOGO } from '../config';
import { initiateTvPairing, login, pollTvPairingStatus } from '../features/auth/api';
import { useAuth, isApiError } from '../store/auth';
import { useFocusNav } from '../hooks/useFocusNav';
import { useBackHandler } from '../hooks/useBackHandler';
import { useWindowHeight } from '../hooks/useWindowHeight';
import { useTranslation } from '../i18n';
import { OnScreenKeyboard } from '../components/OnScreenKeyboard';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// This layout's natural (unscaled) height, roughly — below this viewport
// height, every margin/font/QR-size below shrinks proportionally so the
// whole screen still fits without scrolling (no scroll wheel on a TV
// remote, so overflowing content needs to shrink, not scroll). Floors keep
// things from shrinking so far they become illegible or the QR unscannable.
const NATURAL_HEIGHT = 1100;
const MIN_SCALE = 0.5;
const MIN_QR_SCALE = 0.68;

const POLL_INTERVAL_MS = 2000;
// Matches TvPairingService.PAIRING_TTL_MINUTES on the backend. Counting down
// client-side (rather than parsing the server's expiresAt string) avoids any
// client/server clock or timezone skew affecting the displayed countdown.
const PAIRING_TTL_SECONDS = 5 * 60;
// If the backend rejects the initiate call (e.g. not deployed yet, or a
// transient network blip), retry quietly in the background rather than
// dead-ending on a scary error screen — a TV login screen should feel like
// it's calmly waiting, not broadcasting an internal auth error string.
const RETRY_INTERVAL_MS = 6000;

export default function LoginScreen() {
    const router = useRouter();
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const applySession = useAuth((s) => s.applySession);
    const windowHeight = useWindowHeight();
    const scale = Math.max(MIN_SCALE, Math.min(1, windowHeight / NATURAL_HEIGHT));
    const qrScale = Math.max(MIN_QR_SCALE, scale);
    const gap = (base: number) => Math.round(base * scale);
    const qrBoxSize = Math.round(260 * qrScale);

    const [tab, setTab] = useState<'qr' | 'remote'>('qr');

    // --- QR pairing (primary) ---------------------------------------------
    // 'preparing': no code yet — either the very first attempt, or we're
    //   quietly retrying after a failed initiate call. Never shown as an
    //   alarming error; a TV login screen should read as calm, not broken.
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [qrStatus, setQrStatus] = useState<'preparing' | 'waiting' | 'connected'>('preparing');
    const [secondsLeft, setSecondsLeft] = useState(PAIRING_TTL_SECONDS);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const stopTimers = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const startPairing = useCallback(async () => {
        stopTimers();
        setPairingCode(null);
        setQrStatus('preparing');
        try {
            const { pairingCode: code } = await initiateTvPairing();
            if (!mountedRef.current) return;
            setPairingCode(code);
            setQrStatus('waiting');
            setSecondsLeft(PAIRING_TTL_SECONDS);

            countdownRef.current = setInterval(() => {
                setSecondsLeft((s) => Math.max(0, s - 1));
            }, 1000);

            pollRef.current = setInterval(async () => {
                try {
                    const session = await pollTvPairingStatus(code);
                    if (!mountedRef.current) return;
                    if (session) {
                        setQrStatus('connected');
                        stopTimers();
                        applySession(session);
                        setTimeout(() => router.replace('/profiles'), 900);
                    }
                } catch {
                    // Code expired or was invalidated — quietly fetch a fresh one
                    // rather than stopping and waiting for the user to tap refresh.
                    if (!mountedRef.current) return;
                    startPairing();
                }
            }, POLL_INTERVAL_MS);
        } catch {
            // Backend not reachable yet (e.g. not deployed, or a transient
            // network blip) — retry silently instead of surfacing the raw
            // error to the screen.
            if (!mountedRef.current) return;
            retryTimerRef.current = setTimeout(startPairing, RETRY_INTERVAL_MS);
        }
    }, [applySession, router, stopTimers]);

    useEffect(() => {
        mountedRef.current = true;
        startPairing();
        return () => {
            mountedRef.current = false;
            stopTimers();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-refresh the code once the countdown hits zero.
    useEffect(() => {
        if (secondsLeft === 0 && qrStatus === 'waiting') startPairing();
    }, [secondsLeft, qrStatus, startPairing]);

    // --- Remote login (fallback) -------------------------------------------
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [activeField, setActiveField] = useState<'email' | 'password'>('email');
    // Keyboard only appears once the user actually focuses a field — not on
    // blur, since clicking a keyboard key itself blurs the TextInput (that
    // would make the keyboard vanish the instant you tried to use it).
    // Closed explicitly via the keyboard's own "Done" key instead.
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    const onKeyPress = (key: string) => {
        const setter = activeField === 'password' ? setPassword : setEmail;
        if (key === 'BACKSPACE') {
            setter((v) => v.slice(0, -1));
        } else if (key === 'SPACE') {
            setter((v) => v + ' ');
        } else {
            setter((v) => v + key);
        }
    };
    const [signingIn, setSigningIn] = useState(false);
    const [signInError, setSignInError] = useState<string | null>(null);

    // Back key dismisses the sign-in error alert instead of navigating away.
    useBackHandler(() => setSignInError(null), signInError !== null);

    const onSignIn = async () => {
        setSignInError(null);
        setSigningIn(true);
        try {
            const session = await login({ email: email.trim(), password });
            // login() (features/auth/api.ts) only persists the session to
            // storage — it doesn't touch the in-memory auth store, so without
            // this the store's `user` stays null and /profiles has nothing
            // to render. The QR pairing path already does this correctly.
            applySession(session);
            router.replace('/profiles');
        } catch (err) {
            setSignInError(isApiError(err) ? err.message : strings.login.genericSignInError);
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: theme.static.colorBgPrimary }]}>
            <Image source={{ uri: '/images/login.png' }} style={StyleSheet.absoluteFillObject} blurRadius={18} />
            <View style={[styles.scrim, { backgroundColor: theme.static.colorBgPrimary }]} />

            <View style={[styles.wrapper, { paddingVertical: Math.max(24, Math.round(56 * scale)) }]}>
            <View style={[styles.topRow, { marginBottom: gap(40) }]}>
                <View style={styles.brandRow}>
                    <Image
                        source={ICON_LOGO}
                        style={[styles.logo, { width: Math.round(40 * Math.max(0.75, scale)), height: Math.round(40 * Math.max(0.75, scale)) }]}
                        resizeMode="contain"
                    />
                    <Text style={[styles.brandText, { color: theme.static.colorTextPrimary, fontSize: Math.round(22 * Math.max(0.75, scale)) }]}>
                        Connekyt
                    </Text>
                </View>
                <LanguageSwitcher />
            </View>

            {/* No scroll on a TV login screen — there's no scroll wheel on a
                remote, and drilling a focus target down through off-screen
                content is a bad 10-foot experience. Instead every margin/
                font/QR-size below scales down together (via `scale`/`gap`/
                `qrBoxSize`, derived from the real viewport height) so the
                whole screen always fits on one frame, on any resolution. */}
            <View style={styles.centerGroup}>
            <Text style={[styles.heading, { color: theme.static.colorTextPrimary, fontSize: Math.round(44 * Math.max(0.58, scale)), marginBottom: gap(8) }]}>
                {strings.login.welcomeBack}
            </Text>
            <Text style={[styles.subheading, { color: theme.static.colorTextSecondary, marginBottom: gap(32) }]}>
                {strings.login.subheading}
            </Text>

            <View style={[styles.tabRow, { marginBottom: gap(40) }]}>
                <TabButton label={strings.login.tabQr} active={tab === 'qr'} onPress={() => setTab('qr')} first />
                <TabButton label={strings.login.tabRemote} active={tab === 'remote'} onPress={() => setTab('remote')} />
            </View>

            {tab === 'qr' ? (
                <View style={styles.columns}>
                    <View style={styles.leftCol}>
                        <Text style={[styles.instructions, { color: theme.static.colorTextSecondary, marginBottom: gap(24) }]}>
                            {strings.login.qrInstructions}
                        </Text>
                        {strings.login.steps.map((step, i) => (
                            <View key={step} style={[styles.stepRow, { marginBottom: gap(18) }]}>
                                <View style={[styles.stepBadge, { borderColor: theme.static.colorAccent }]}>
                                    <Text style={[styles.stepNumber, { color: theme.static.colorAccent }]}>{i + 1}</Text>
                                </View>
                                <Text style={[styles.stepText, { color: theme.static.colorTextPrimary }]}>{step}</Text>
                            </View>
                        ))}
                        <TouchableOpacity onPress={() => setTab('remote')} style={[styles.switchLink, { marginTop: gap(24) }]}>
                            <Text style={[styles.switchLinkText, { color: theme.static.colorAccent }]}>
                                {strings.login.switchToRemote}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.rightCol}>
                        <View style={[styles.qrCard, styles.glass, { padding: Math.round(32 * qrScale) }]}>
                            <CornerBrackets color={theme.static.colorAccent} />
                            <View style={[styles.qrBox, { width: qrBoxSize, height: qrBoxSize }]}>
                                {!pairingCode ? (
                                    <ActivityIndicator size="large" color={theme.static.colorAccent} />
                                ) : pairingCode ? (
                                    <QRCodeSVG
                                        value={JSON.stringify({ code: pairingCode })}
                                        size={Math.round(220 * qrScale)}
                                        bgColor="#FFFFFF"
                                        fgColor="#0B0B10"
                                        level="M"
                                    />
                                ) : null}
                            </View>
                        </View>
                    </View>
                </View>
            ) : (
                <>
                <View style={styles.columns}>
                    <View style={[styles.leftCol, styles.formCard, styles.glass, { padding: Math.round(32 * qrScale) }]}>
                        <Text style={[styles.instructions, { color: theme.static.colorTextSecondary, marginBottom: gap(24) }]}>
                            {strings.login.remoteInstructions}
                        </Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            onFocus={() => { setActiveField('email'); setKeyboardVisible(true); }}
                            placeholder={strings.login.emailPlaceholder}
                            placeholderTextColor={theme.static.colorTextSecondary}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            hasTVPreferredFocus
                            style={[
                                styles.input,
                                { color: theme.static.colorTextPrimary, borderColor: theme.static.colorBorder, marginBottom: gap(16) },
                                activeField === 'email' && { borderColor: theme.static.colorFocusRing },
                            ]}
                        />
                        <View style={styles.passwordRow}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => { setActiveField('password'); setKeyboardVisible(true); }}
                                placeholder={strings.login.passwordPlaceholder}
                                placeholderTextColor={theme.static.colorTextSecondary}
                                secureTextEntry={!showPassword}
                                style={[
                                    styles.input,
                                    styles.passwordInput,
                                    { color: theme.static.colorTextPrimary, borderColor: theme.static.colorBorder },
                                    activeField === 'password' && { borderColor: theme.static.colorFocusRing },
                                ]}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword((s) => !s)}
                                style={styles.showPasswordButton}
                            >
                                <Text style={[styles.showPasswordText, { color: theme.static.colorAccent }]}>
                                    {showPassword ? strings.login.hide : strings.login.show}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <SignInButton onPress={onSignIn} loading={signingIn} label={strings.login.signInButton} />
                        <TouchableOpacity onPress={() => setTab('qr')} style={[styles.switchLink, { marginTop: gap(24) }]}>
                            <Text style={[styles.switchLinkText, { color: theme.static.colorAccent }]}>
                                {strings.login.switchToQr}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.rightCol}>
                        {keyboardVisible ? (
                            <OnScreenKeyboard onKeyPress={onKeyPress} onDone={() => setKeyboardVisible(false)} />
                        ) : (
                            <Image
                                source={ICON_LOGO}
                                style={[styles.bigLogo, { width: Math.round(220 * qrScale), height: Math.round(220 * qrScale) }]}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                </View>
                </>
            )}

            <View style={[styles.footer, { marginTop: gap(28) }]}>
                <Text style={[styles.footerText, { color: theme.static.colorTextSecondary }]}>
                    {strings.login.developedByPrefix}
                    {'  '}
                    <Text style={styles.footerBrand}>Amoria Global Tech</Text>
                </Text>
            </View>
            </View>
            </View>

            {signInError ? (
                <SignInErrorModal message={signInError} onDismiss={() => setSignInError(null)} />
            ) : null}
        </View>
    );
}

/** Centered, full-screen alert for a failed sign-in — a small red line under
 *  the password field is easy to miss from a couch on a TV; a modal in the
 *  middle of the screen with a focusable button isn't. Sibling of the whole
 *  page (not nested inside the form card) so it overlays both tabs and
 *  isn't clipped by anything, and grabs remote focus immediately. */
function SignInErrorModal({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    return (
        <View style={styles.alertOverlay}>
            <View style={[styles.alertCard, styles.glass]}>
                <View style={[styles.alertIconCircle, { backgroundColor: 'rgba(248,113,113,0.14)' }]}>
                    <i className="bi bi-x-lg" style={{ fontSize: 26, color: theme.static.colorError }} />
                </View>
                <Text style={[styles.alertTitle, { color: theme.static.colorTextPrimary }]}>
                    {strings.login.signInErrorTitle}
                </Text>
                <Text style={[styles.alertMessage, { color: theme.static.colorTextSecondary }]}>{message}</Text>
                <TryAgainButton onPress={onDismiss} label={strings.login.tryAgainButton} />
            </View>
        </View>
    );
}

function TryAgainButton({ onPress, label }: { onPress: () => void; label: string }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            hasTVPreferredFocus
            {...focusProps}
            style={[
                styles.alertButton,
                { backgroundColor: theme.static.colorAccent },
                focused && { borderWidth: 2, borderColor: theme.static.colorFocusRing },
            ]}
        >
            <Text style={styles.alertButtonText}>{label}</Text>
        </TouchableOpacity>
    );
}

function TabButton({ label, active, onPress, first }: { label: string; active: boolean; onPress: () => void; first?: boolean }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            hasTVPreferredFocus={first}
            {...focusProps}
            style={[
                styles.tabButton,
                active && { backgroundColor: theme.static.colorAccent },
                focused && !active && { backgroundColor: 'rgba(255,255,255,0.08)' },
            ]}
        >
            <Text style={[styles.tabText, { color: active ? '#fff' : theme.static.colorTextSecondary }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function SignInButton({ onPress, loading, label }: { onPress: () => void; loading: boolean; label: string }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading}
            {...focusProps}
            style={[
                styles.signInButton,
                { backgroundColor: theme.static.colorAccent },
                focused && { borderWidth: 2, borderColor: theme.static.colorFocusRing },
            ]}
        >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>{label}</Text>}
        </TouchableOpacity>
    );
}

function CornerBrackets({ color }: { color: string }) {
    const corner = { position: 'absolute' as const, width: 28, height: 28 };
    return (
        <>
            <View style={[corner, { top: -6, left: -6, borderTopWidth: 3, borderLeftWidth: 3, borderColor: color, borderTopLeftRadius: 12 }]} />
            <View style={[corner, { top: -6, right: -6, borderTopWidth: 3, borderRightWidth: 3, borderColor: color, borderTopRightRadius: 12 }]} />
            <View style={[corner, { bottom: -6, left: -6, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: color, borderBottomLeftRadius: 12 }]} />
            <View style={[corner, { bottom: -6, right: -6, borderBottomWidth: 3, borderRightWidth: 3, borderColor: color, borderBottomRightRadius: 12 }]} />
        </>
    );
}

const styles = StyleSheet.create({
    // minHeight: '100vh' guarantees full viewport coverage regardless of
    // whatever the html/body/#__next chain does with height — flex:1 alone
    // only fills its parent's height, and if that parent hasn't propagated
    // 100% height, the page falls short of the viewport, exposing the
    // browser's default white background as a strip at the bottom.
    root: { flex: 1, minHeight: '100vh', position: 'relative' } as object,
    // Dark scrim over the blurred backdrop photo — high enough to keep text
    // readable, low enough that the photo is still visibly there (the point
    // of the effect), matching the glassmorphism look from the Figma mock.
    scrim: { ...StyleSheet.absoluteFillObject, opacity: 0.55 } as object,
    wrapper: { flex: 1, paddingHorizontal: 56, paddingVertical: 56 },
    // position + zIndex here (not just on the dropdown menu itself) matter:
    // centerGroup below is a later DOM sibling with no z-index of its own,
    // so without this its bounding box silently sits on top of — and
    // swallows clicks meant for — the language dropdown, even though the
    // dropdown visually renders fine (zIndex on a descendant only orders it
    // among ITS OWN siblings, not against an unrelated subtree like this).
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 40,
        position: 'relative',
        zIndex: 50,
    } as object,
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    // Groups heading→tabs→QR/form as one visual unit that centers together
    // in the space below the brand row, instead of the tabs sitting
    // top-anchored while the QR/instructions block centers independently
    // in its own leftover space (which read as a big dead gap between them).
    // No scroll here on purpose (see the height-scaling comment above the
    // JSX) — flex:1 + justifyContent:'center' is safe now that every child
    // margin/font/QR-size shrinks with the viewport instead of staying
    // fixed and overflowing.
    centerGroup: { flex: 1, justifyContent: 'center' },
    logo: { width: 40, height: 40 },
    brandText: { fontSize: 22, fontWeight: '700' },
    heading: { fontSize: 44, fontWeight: '800', marginBottom: 8 },
    subheading: { fontSize: 18, marginBottom: 32 },
    // A single shared track/bar (like a segmented control) rather than two
    // separate floating pills — the active tab is a solid highlight that
    // sits inside this one container.
    tabRow: {
        flexDirection: 'row',
        marginBottom: 40,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.10)',
        padding: 5,
    },
    tabButton: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999 },
    tabText: { fontSize: 15, fontWeight: '700' },
    columns: { flexDirection: 'row', gap: 64 },
    leftCol: { flex: 1, maxWidth: 480 },
    rightCol: { flex: 1, alignItems: 'center', paddingHorizontal: 40 },
    bigLogo: { width: 220, height: 220 },
    instructions: { fontSize: 16, marginBottom: 24, lineHeight: 22 },
    stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 14 },
    stepBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumber: { fontSize: 14, fontWeight: '800' },
    stepText: { fontSize: 16, flex: 1 },
    switchLink: { marginTop: 24 },
    switchLinkText: { fontSize: 14 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16 },
    passwordRow: { position: 'relative', justifyContent: 'center' },
    passwordInput: { paddingRight: 70 },
    showPasswordButton: { position: 'absolute', right: 16, top: 14, bottom: 16, justifyContent: 'center' },
    showPasswordText: { fontSize: 14, fontWeight: '700' },
    signInButton: { borderRadius: 9999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    signInText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    qrCard: { borderRadius: 20, padding: 32, position: 'relative' },
    formCard: { borderRadius: 20, padding: 32, maxWidth: 480 },
    // Frosted-glass treatment: more transparent fill + a stronger backdrop
    // blur (with a saturation boost, a common glassmorphism trick that makes
    // the colors showing through read as "frosted" rather than "murky"), a
    // brighter edge highlight, and a soft elevation shadow with an inset
    // top highlight so the card reads as a pane of glass catching light,
    // not just a dark box.
    glass: {
        backgroundColor: 'rgba(21, 21, 28, 0.38)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    } as object,
    qrBox: {
        width: 260,
        height: 260,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    // Sits in normal flow, right after centerGroup, with its own breathing
    // room above it — not pinned to the viewport bottom, so it can never
    // overlap the centered content no matter the screen's aspect ratio.
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28 },
    footerText: { fontSize: 12.5, fontWeight: '500', letterSpacing: 0.2 },
    // Brand name in the brand→accent gradient (matches the gradient-text
    // treatment knockout's own web login uses) rather than plain bold, so
    // it reads as a deliberate credit instead of an afterthought — no pill/
    // border around it this time, just quiet watermark-style text sitting
    // under everything else.
    footerBrand: {
        fontWeight: '800',
        letterSpacing: 0.2,
        backgroundImage: 'linear-gradient(90deg, #4C8DFF 0%, #F20C8F 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    } as object,
    alertOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 100,
        padding: 24,
    } as object,
    alertCard: {
        width: 400,
        maxWidth: '100%',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
    },
    alertIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alertTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    alertMessage: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    alertButton: { alignSelf: 'stretch', borderRadius: 9999, paddingVertical: 14, alignItems: 'center' },
    alertButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
