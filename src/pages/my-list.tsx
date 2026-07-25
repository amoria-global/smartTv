import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext } from '../config';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { FocusableCard } from '../components/FocusableCard';
import { TvVideo } from '../api/catalog';
import { getBookmarks } from '../features/bookmarks/api';
import { useTranslation } from '../i18n';
import { getStatusBadge } from '../utils/statusBadge';
import { useWindowWidth } from '../hooks/useWindowWidth';

const GRID_COLUMNS = 4;
const GRID_GAP = 24;
// Landscape, not portrait - see Row.tsx's CARD_ASPECT_RATIO comment for why.
const CARD_ASPECT_RATIO = 3 / 4;
const FALLBACK_CARD_WIDTH = 240;
// Must match styles.content's horizontal padding below.
const CONTENT_HORIZONTAL_PADDING = 48;
// useWindowWidth reads window.innerWidth, which includes the vertical
// scrollbar's width in Chrome — the actual flex row (inside the scrollable
// area) renders a little narrower than that. Sizing cards to an exact-fit
// width with zero slack meant that gap alone was sometimes enough to push
// the last card in a row to overflow and wrap, leaving a whole column's
// worth of empty space on the right (same bug found and fixed on search.tsx).
const SAFETY_MARGIN = 32;

// Device-local only (see features/bookmarks/api.ts). Read fresh on mount —
// Next.js's Pages Router remounts this component on every navigation into
// it, so a plain effect (same pattern as every other page here) is enough to
// pick up bookmarks added/removed elsewhere.
export default function MyListScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();

    const [videos, setVideos] = useState<TvVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const windowWidth = useWindowWidth();
    const gridWidth = windowWidth - CONTENT_HORIZONTAL_PADDING * 2;
    const columnGap = GRID_GAP + 16;
    const cardWidth =
        gridWidth > 0
            ? Math.floor((gridWidth - SAFETY_MARGIN - columnGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
            : FALLBACK_CARD_WIDTH;
    const cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO);

    useEffect(() => {
        let active = true;
        getBookmarks().then((saved) => {
            if (active) {
                setVideos(saved);
                setLoading(false);
            }
        });
        return () => {
            active = false;
        };
    }, []);

    const statusStrings = {
        liveNow: strings.detail.liveNow,
        startingSoon: strings.detail.startingSoon,
        cancelled: strings.detail.cancelled,
        ended: strings.detail.ended,
    };

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{strings.myList.title}</Text>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={theme.static.colorAccent} />
                    </View>
                ) : videos.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={[styles.emptyIconCircle, { backgroundColor: theme.static.colorSurfaceMuted }]}>
                            <i className="bi bi-bookmark-heart" style={{ fontSize: 30, color: theme.static.colorAccent }} />
                        </View>
                        <Text style={[styles.body, { color: theme.static.colorTextSecondary }]}>{strings.myList.body}</Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {videos.map((v, i) => (
                            <FocusableCard
                                key={v.id}
                                eventId={v.id}
                                title={v.title}
                                image={v.imageUrl}
                                width={cardWidth}
                                height={cardHeight}
                                hasTVPreferredFocus={i === 0}
                                badge={getStatusBadge(v.status, theme.static, statusStrings)}
                                eventDate={v.eventDate}
                                startTime={v.startTime}
                                location={v.location}
                                hostName={v.hostName}
                                streamFee={v.streamFee}
                                streamFeeCurrencySymbol={v.streamFeeCurrencySymbol}
                                status={v.status}
                                onPress={() => router.push(`/detail?id=${v.id}`)}
                            />
                        ))}
                    </View>
                )}
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    content: { flex: 1, padding: 48 },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 28 },
    center: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
    emptyState: { alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 16 },
    emptyIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    body: { fontSize: 16, maxWidth: 420, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, minHeight: 340 },
});
