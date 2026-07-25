import React, { useContext } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext } from '../config';
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
    const { strings } = useTranslation();
    const router = useRouter();

    if (!liveVideos.length) return null;

    return (
        <View style={styles.trendsSection}>
            <View style={styles.trendsRow}>
                <View style={styles.trendsPill}>
                    <i className="bi bi-fire" style={{ fontSize: 14, color: '#fff' }} />
                    <Text style={styles.trendsPillText}>{strings.events.hotLiveTrends}</Text>
                    <View style={styles.trendsCountBadge}>
                        <Text style={styles.trendsCountText}>{liveCount}</Text>
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
            <View style={[styles.trendRingOuter, focused && { transform: [{ scale: 1.08 }] }]}>
                <View style={[styles.trendRingInner, { backgroundColor: theme.static.colorBgPrimary }]}>
                    {video.imageUrl ? <Image source={{ uri: video.imageUrl }} style={styles.trendImage} resizeMode="cover" /> : null}
                </View>
                <View style={[styles.trendLiveBadge, { backgroundColor: theme.static.colorError }]}>
                    <Text style={styles.trendLiveBadgeText}>LIVE</Text>
                </View>
            </View>
            <Text numberOfLines={1} style={[styles.trendLabel, { color: theme.static.colorTextPrimary }]}>
                {video.title}
            </Text>
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
        borderRadius: 999,
        backgroundImage: 'linear-gradient(90deg, #FFA726, #F20C8F)',
        zIndex: 1,
    } as object,
    trendsPillText: { color: '#fff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    trendsCountBadge: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    trendsCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    // Short gradient flourish trailing the pill into the first circle — a
    // fixed width (not flex:1, which used to stretch across all leftover
    // row space and shove the circle strip to the far edge whenever there
    // were few live items to fill it).
    connectorLine: {
        width: 40,
        height: 2,
        marginLeft: -12,
        marginRight: -20,
        backgroundImage: 'linear-gradient(90deg, #F20C8F, rgba(242,12,143,0))',
    } as object,
    trendsScroll: { alignItems: 'center', gap: 20, paddingLeft: 32, paddingRight: 24 },
    trendItem: { alignItems: 'center', width: 88, zIndex: 1 },
    trendRingOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        padding: 3,
        backgroundImage: 'linear-gradient(135deg, #FFA726, #F20C8F)',
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
    trendLiveBadge: { position: 'absolute', bottom: -6, alignSelf: 'center', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
    trendLiveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    trendLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
