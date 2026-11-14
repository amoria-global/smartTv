import React, { useContext } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { ThemeContext, radii } from '../config';
import { glassSurface, glassWell } from './glass/glassStyle';
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
            <View style={[glassSurface(theme.static, { radius: radii.card, raised: true }), styles.card, styles.anyMomentCard, style]}>
                <i className="bi bi-hourglass-split" style={{ fontSize: 15, color: theme.static.colorAccent }} />
                <AppText variant="display" style={[styles.headerText, { color: theme.static.colorAccentLight }]}>{strings.detail.startingAnyMoment}</AppText>
            </View>
        );
    }

    const cd = splitCountdown(msRemaining);
    return (
        <View style={[glassSurface(theme.static, { radius: radii.card, raised: true }), styles.card, style]}>
            <View style={styles.header}>
                <i className="bi bi-hourglass-split" style={{ fontSize: 13, color: theme.static.colorAccent }} />
                <AppText variant="display" style={[styles.headerText, { color: theme.static.colorAccentLight }]}>{strings.detail.startsIn}</AppText>
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
        <View style={[glassWell(theme.static, radii.tile), styles.box]}>
            <AppText variant="display" style={[styles.value, { color: theme.static.colorTextPrimary }]}>{value}</AppText>
            <AppText variant="display" style={[styles.label, { color: theme.static.colorTextSecondary }]}>{label}</AppText>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    anyMomentCard: { flexDirection: 'row', gap: 10, paddingVertical: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    headerText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
    boxes: { flexDirection: 'row', gap: 10 },
    box: {
        minWidth: 60,
        paddingVertical: 8,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    value: { fontSize: 30, fontWeight: '800', letterSpacing: 0.5, lineHeight: 34 },
    label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
});
