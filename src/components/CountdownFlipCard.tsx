import React, { useContext } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ThemeContext } from '../config';
import { useTranslation } from '../i18n';
import { splitCountdown, pad2 } from '../utils/countdown';

/**
 * The "STARTS IN" flip-card (DAYS/HR/MIN/SEC) shown for upcoming events — on
 * the detail hero and the player's pre-event lobby. Purely presentational: the
 * parent owns the tick (passes a fresh `msRemaining`), which keeps the
 * re-render cadence under the parent's control rather than baked in here.
 */
export function CountdownFlipCard({ msRemaining, style }: { msRemaining: number; style?: ViewStyle }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();

    // Start time already passed but the event is still "upcoming" (hasn't gone
    // live yet) — there's no future span to count down, so show a friendly
    // "any moment now" instead of a blank card or a frozen 00:00:00.
    if (msRemaining <= 0) {
        return (
            <View style={[styles.card, styles.anyMomentCard, style]}>
                <i className="bi bi-hourglass-split" style={{ fontSize: 15, color: theme.static.colorAccent }} />
                <Text style={[styles.headerText, { color: theme.static.colorAccentLight }]}>{strings.detail.startingAnyMoment}</Text>
            </View>
        );
    }

    const cd = splitCountdown(msRemaining);
    return (
        <View style={[styles.card, style]}>
            <View style={styles.header}>
                <i className="bi bi-hourglass-split" style={{ fontSize: 13, color: theme.static.colorAccent }} />
                <Text style={[styles.headerText, { color: theme.static.colorAccentLight }]}>{strings.detail.startsIn}</Text>
            </View>
            <View style={styles.boxes}>
                {cd.days > 0 ? <Box value={pad2(cd.days)} label={strings.detail.unitDays} /> : null}
                <Box value={pad2(cd.hours)} label={strings.detail.unitHours} />
                <Box value={pad2(cd.minutes)} label={strings.detail.unitMinutes} />
                <Box value={pad2(cd.seconds)} label={strings.detail.unitSeconds} />
            </View>
        </View>
    );
}

function Box({ value, label }: { value: string; label: string }) {
    const { theme } = useContext(ThemeContext);
    return (
        <View style={styles.box}>
            <Text style={[styles.value, { color: theme.static.colorTextPrimary }]}>{value}</Text>
            <Text style={[styles.label, { color: theme.static.colorTextSecondary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 18,
        backgroundColor: 'rgba(22,36,60,0.62)',
        boxShadow: '0 14px 34px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(170,195,240,0.22)',
        alignItems: 'center',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
    } as object,
    anyMomentCard: { flexDirection: 'row', gap: 10, paddingVertical: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    headerText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
    boxes: { flexDirection: 'row', gap: 10 },
    box: {
        minWidth: 60,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(4,9,18,0.55)',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        alignItems: 'center',
    } as object,
    value: { fontSize: 30, fontWeight: '800', letterSpacing: 0.5, lineHeight: 34 },
    label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
});
