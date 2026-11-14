import React, { useContext } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from './AppText';
import { useRouter } from 'next/router';
import { ThemeContext, alpha, motion, palette, radii } from '../config';
import { focusGlow, raisedButton } from './glass/glassStyle';
import { useFocusNav } from '../hooks/useFocusNav';
import { TvVideo } from '../api/catalog';
import { useTranslation } from '../i18n';

type Props = {
    liveVideos: TvVideo[];
    liveCount: number;
};

/**
 * "Hot Live Trends" circle strip — real currently-live events, shown as a
 * horizontal-scroll row of avatar circles. The All/Live/Upcoming/Ended
 * filter tabs that used to live directly below this moved into the global
 * Navbar (see components/Navbar.tsx) so they're reachable from any page,
 * not just once you'd already navigated to /events — this component is now
 * just the trends strip.
 */
export function HotLiveTrendsBar({ liveVideos, liveCount }: Props) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();

    if (!liveVideos.length) return null;

    return (
        <View style={styles.trendsSection}>
            <View style={styles.trendsRow}>
                <View style={[raisedButton(theme.static, 'live'), styles.trendsPill]}>
                    <i className="bi bi-fire" style={{ fontSize: 14, color: palette.white }} />
                    <AppText variant="display" style={styles.trendsPillText}>{strings.events.hotLiveTrends}</AppText>
                    <View style={styles.trendsCountBadge}>
                        <AppText variant="display" style={styles.trendsCountText}>{liveCount}</AppText>
                    </View>
                </View>
                <View style={styles.connectorLine} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendsScroll}>
                    {liveVideos.map((v) => (
                        <TrendCircle key={v.id} video={v} onPress={() => router.push(`/detail?id=${v.id}`)} />
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

function TrendCircle({ video, onPress }: { video: TvVideo; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity onPress={onPress} {...focusProps} style={styles.trendItem}>
            <View style={[styles.trendRingOuter, focusGlow(theme.static, focused, true)]}>
                <View style={[styles.trendRingInner, { backgroundColor: theme.static.colorBgPrimary }]}>
                    {video.imageUrl ? <Image source={{ uri: video.imageUrl }} style={styles.trendImage} resizeMode="cover" /> : null}
                </View>
                <View style={[styles.trendLiveBadge, { backgroundColor: theme.static.colorLive }]}>
                    <AppText variant="display" style={styles.trendLiveBadgeText}>LIVE</AppText>
                </View>
            </View>
            <AppText numberOfLines={1} style={[styles.trendLabel, { color: theme.static.colorTextPrimary }]}>
                {video.title}
            </AppText>
        </TouchableOpacity>
    );
}


const styles = StyleSheet.create({
    trendsSection: { marginBottom: 32 },
    trendsRow: { flexDirection: 'row', alignItems: 'center' },
    trendsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 18,
        zIndex: 1,
    } as object,
    trendsPillText: { color: palette.white, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    trendsCountBadge: { backgroundColor: alpha(palette.white, 0.3), borderRadius: radii.pill, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    trendsCountText: { color: palette.white, fontSize: 11, fontWeight: '800' },
    // Short gradient flourish trailing the pill into the first circle — a
    // fixed width (not flex:1, which used to stretch across all leftover
    // row space and shove the circle strip to the far edge whenever there
    // were few live items to fill it).
    connectorLine: {
        width: 40,
        height: 2,
        marginLeft: -12,
        marginRight: -20,
        backgroundImage: `linear-gradient(90deg, ${palette.live}, ${alpha(palette.live, 0)})`,
    } as object,
    trendsScroll: { alignItems: 'center', gap: 20, paddingLeft: 32, paddingRight: 24 },
    trendItem: { alignItems: 'center', width: 88, zIndex: 1 },
    trendRingOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        padding: 3,
        backgroundColor: palette.live,
        backgroundImage: `linear-gradient(135deg, ${palette.liveHot}, ${palette.live})`,
        transitionProperty: 'transform, box-shadow',
        transitionDuration: `${motion.fast}ms`,
        transitionTimingFunction: motion.css,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    } as object,
    trendRingInner: {
        width: '100%',
        height: '100%',
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    trendImage: { width: '100%', height: '100%' },
    trendLiveBadge: { position: 'absolute', bottom: -6, alignSelf: 'center', paddingVertical: 2, paddingHorizontal: 8, borderRadius: radii.pill },
    trendLiveBadgeText: { color: palette.white, fontSize: 9, fontWeight: '800' },
    trendLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
