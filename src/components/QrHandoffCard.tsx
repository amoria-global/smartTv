import React, { useContext } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from './AppText';
import { midnightGlass } from './glass/glassStyle';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext, alpha, palette } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';

export type QrStep = { icon: string; text: string };

/**
 * The one "continue on your phone" QR card used everywhere in the app — the
 * reserve/share handoffs on the detail page and the donate/gift panels on the
 * player. Wide two-column layout (big QR left · icon/title/price/steps/status
 * right) so every QR moment looks identical, matching the Watch-Live pay gate.
 *
 * The caller supplies its own overlay wrapper isn't needed — this renders the
 * full-screen dark overlay itself; pass `overlayZIndex` to sit above whatever
 * surface it's on (a page vs. the video player).
 */
export function QrHandoffCard({
    url,
    icon,
    title,
    subtitle,
    priceLabel,
    steps = [],
    waitingText,
    onClose,
    qrSize = 248,
    overlayZIndex = 50,
}: {
    url: string;
    icon: string;
    title: string;
    subtitle: string;
    priceLabel?: string;
    steps?: QrStep[];
    waitingText?: string;
    onClose?: () => void;
    qrSize?: number;
    overlayZIndex?: number;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <View style={[styles.overlay, { zIndex: overlayZIndex }]}>
            <View style={[styles.card, midnightGlass as object]}>
                {onClose ? (
                    <TouchableOpacity
                        onPress={onClose}
                        hasTVPreferredFocus
                        {...focusProps}
                        style={[styles.close, focused && { backgroundColor: theme.static.colorFocusRing }]}
                    >
                        <i className="bi bi-x-lg" style={{ fontSize: 16, color: palette.white }} />
                    </TouchableOpacity>
                ) : null}

                {/* LEFT — the QR the phone scans */}
                <View style={styles.qrBox}>
                    <QRCodeSVG value={url} size={qrSize} bgColor={palette.qrPaper} fgColor={palette.qrInk} level="M" />
                </View>

                {/* RIGHT — icon, title, price, steps, status */}
                <View style={styles.right}>
                    <i className={`bi ${icon}`} style={{ fontSize: 30, color: theme.static.colorPrimaryLight, marginBottom: 8 }} />
                    <AppText variant="display" style={[styles.title, { color: theme.static.colorTextPrimary }]}>{title}</AppText>
                    <AppText style={[styles.subtitle, { color: theme.static.colorTextSecondary }]}>{subtitle}</AppText>

                    {priceLabel ? (
                        <View style={styles.pricePill}>
                            <AppText variant="display" style={styles.priceText}>{priceLabel}</AppText>
                        </View>
                    ) : null}

                    {steps.length ? (
                        <View style={styles.options}>
                            {steps.map((s, i) => (
                                <View key={i} style={styles.optionRow}>
                                    <i className={`bi ${s.icon}`} style={{ fontSize: 15, color: theme.static.colorAccent }} />
                                    <AppText style={[styles.optionText, { color: theme.static.colorTextSecondary }]}>{s.text}</AppText>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {waitingText ? (
                        <View style={styles.waitingRow}>
                            <ActivityIndicator size="small" color={theme.static.colorAccent} />
                            <AppText style={[styles.waitingText, { color: theme.static.colorTextSecondary }]}>{waitingText}</AppText>
                        </View>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: alpha(palette.black, 0.65),
    } as object,
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 40,
        width: 760,
        maxWidth: '92%',
        borderRadius: 24,
        borderWidth: 1,
        padding: 40,
        position: 'relative',
    } as object,
    close: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: alpha(palette.white, 0.12),
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    } as object,
    qrBox: {
        width: 288,
        height: 288,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.white,
    },
    right: { flex: 1, alignItems: 'flex-start' },
    title: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.4 },
    subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
    pricePill: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: alpha(palette.accent, 0.14),
        marginBottom: 20,
    },
    priceText: { color: palette.accentLight, fontSize: 16, fontWeight: '800' },
    options: { alignSelf: 'stretch', gap: 12, marginBottom: 4 },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    optionText: { fontSize: 13.5, fontWeight: '600' },
    waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
    waitingText: { fontSize: 13, fontWeight: '600', flex: 1 },
});
