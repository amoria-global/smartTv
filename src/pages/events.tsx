import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext } from '../config';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { FocusableCard } from '../components/FocusableCard';
import { HotLiveTrendsBar } from '../components/HotLiveTrendsBar';
import { useFocusNav } from '../hooks/useFocusNav';
import { useWindowWidth } from '../hooks/useWindowWidth';
import { EventTabFilter, fetchEventsPage, TvVideo, UiEventStatus } from '../api/catalog';
import { useTranslation } from '../i18n';
import { getStatusBadge } from '../utils/statusBadge';

const PAGE_SIZE = 8;
const TRENDS_LIMIT = 10;
const GRID_COLUMNS = 4;
const GRID_GAP = 24;
// Landscape, not portrait - see Row.tsx's CARD_ASPECT_RATIO comment for why
// (matches the actual shape of uploaded event posters: square to ~1.6:1
// landscape, never portrait - the old value cropped their edges off).
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

function isEventTabFilter(v: unknown): v is EventTabFilter {
    return v === 'ALL' || v === 'LIVE' || v === 'UPCOMING' || v === 'ENDED';
}

export default function EventsScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();

    const [filter, setFilter] = useState<EventTabFilter>('ALL');
    const [page, setPage] = useState(0);
    const [videos, setVideos] = useState<TvVideo[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const [liveVideos, setLiveVideos] = useState<TvVideo[]>([]);
    const [liveCount, setLiveCount] = useState(0);

    // window.innerWidth (not RN's onLayout, which never fires for this View
    // in this react-native-web setup — see useWindowWidth) is what makes "4
    // columns" actually hold regardless of window size, instead of every
    // card silently sitting at FALLBACK_CARD_WIDTH forever.
    const windowWidth = useWindowWidth();
    const gridWidth = windowWidth - CONTENT_HORIZONTAL_PADDING * 2;
    // FocusableCard also carries its own marginRight:16 (needed for Row.tsx's
    // horizontal-scroll spacing elsewhere) which stacks with this grid's own
    // gap:24 — budget for both so 4 columns actually fit instead of wrapping to 3.
    const columnGap = GRID_GAP + 16;
    const cardWidth =
        gridWidth > 0
            ? Math.floor((gridWidth - SAFETY_MARGIN - columnGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
            : FALLBACK_CARD_WIDTH;
    const cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO);

    // The All/Live/Upcoming/Ended tabs live in the global Navbar now (see
    // components/Navbar.tsx) — selecting one pushes /events?filter=X (or
    // plain /events for "All"), and this page just reacts to the query
    // param. No-filter must map to 'ALL' explicitly, not be ignored — the
    // Navbar's "All events" tab pushes a bare /events, and without this an
    // already-filtered page (e.g. arrived via ?filter=LIVE) would stay
    // stuck on the old filter instead of clearing. Also resets to page 0 on
    // every real filter change, since a stale page number from a previous
    // filter could point past the end of the new filtered set.
    useEffect(() => {
        const next = isEventTabFilter(router.query.filter) ? router.query.filter : 'ALL';
        setFilter(next);
        setPage(0);
    }, [router.query.filter]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetchEventsPage(page, PAGE_SIZE, filter)
            .then((res) => {
                if (!active) return;
                setVideos(res.videos);
                setTotalPages(Math.max(1, res.totalPages));
            })
            .catch(() => active && setVideos([]))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [page, filter]);

    // "Hot Live Trends" + the Live-now tab count both come from one real
    // fetch — no separate mocked counter.
    useEffect(() => {
        let active = true;
        fetchEventsPage(0, TRENDS_LIMIT, 'LIVE').then((res) => {
            if (!active) return;
            setLiveVideos(res.videos);
            setLiveCount(res.totalElements);
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

    // The backend's own status filter already guarantees every item in a
    // LIVE/UPCOMING/ENDED-filtered page belongs to that bucket — trusting
    // that over each item's own computed status (catalog.ts's isLiveEvent)
    // avoids a stale hasLiveStream flag (set once when a stream starts, not
    // always cleared once it actually ends) painting an already-completed
    // event with a red "LIVE NOW" badge under the Recently ended tab.
    const effectiveStatus = (status: UiEventStatus | undefined): UiEventStatus | undefined => {
        if (status === 'CANCELLED') return status;
        if (filter === 'LIVE') return 'LIVE';
        if (filter === 'UPCOMING') return 'UPCOMING';
        if (filter === 'ENDED') return 'ENDED';
        return status;
    };

    // This heading used to always read "All Events" no matter which Navbar
    // tab was active — reusing the same tab labels shown up there instead,
    // so switching to "Recently ended" actually says "Recently ended" here
    // too, rather than leaving the page's own title stuck on "All Events".
    const pageTitle =
        filter === 'LIVE'
            ? strings.events.tabLive
            : filter === 'UPCOMING'
              ? strings.events.tabUpcoming
              : filter === 'ENDED'
                ? strings.events.tabEnded
                : strings.events.title;

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
                <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{pageTitle}</Text>

                <HotLiveTrendsBar liveVideos={liveVideos} liveCount={liveCount} />

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={theme.static.colorAccent} />
                    </View>
                ) : videos.length === 0 ? (
                    <View style={styles.center}>
                        <Text style={{ color: theme.static.colorTextSecondary, fontSize: 16 }}>{strings.events.empty}</Text>
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
                                badge={getStatusBadge(effectiveStatus(v.status), theme.static, statusStrings)}
                                eventDate={v.eventDate}
                                startTime={v.startTime}
                                location={v.location}
                                hostName={v.hostName}
                                streamFee={v.streamFee}
                                streamFeeCurrencySymbol={v.streamFeeCurrencySymbol}
                                status={effectiveStatus(v.status)}
                                onPress={() => router.push(`/detail?id=${v.id}`)}
                            />
                        ))}
                    </View>
                )}

                {totalPages > 1 && (
                    <View style={styles.pagination}>
                        <PageButton
                            label={strings.events.prev}
                            icon="bi-chevron-left"
                            disabled={page <= 0 || loading}
                            onPress={() => setPage((p) => Math.max(0, p - 1))}
                        />
                        <View style={[styles.pageDivider, { backgroundColor: theme.static.colorBorder }]} />
                        <Text style={[styles.pageLabel, { color: theme.static.colorTextSecondary }]}>
                            {strings.events.page} {page + 1} {strings.events.of} {totalPages}
                        </Text>
                        <View style={[styles.pageDivider, { backgroundColor: theme.static.colorBorder }]} />
                        <PageButton
                            label={strings.events.next}
                            icon="bi-chevron-right"
                            iconRight
                            disabled={page >= totalPages - 1 || loading}
                            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        />
                    </View>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

function PageButton({
    label,
    icon,
    iconRight,
    disabled,
    onPress,
}: {
    label: string;
    icon: string;
    iconRight?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            {...focusProps}
            style={[
                styles.pageButton,
                focused && !disabled && { backgroundColor: theme.static.colorFocusRing },
                disabled && { opacity: 0.35 },
            ]}
        >
            {!iconRight ? <i className={`bi ${icon}`} style={{ fontSize: 14, color: theme.static.colorTextPrimary }} /> : null}
            <Text style={[styles.pageButtonText, { color: theme.static.colorTextPrimary }]}>{label}</Text>
            {iconRight ? <i className={`bi ${icon}`} style={{ fontSize: 14, color: theme.static.colorTextPrimary }} /> : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    content: { padding: 48, paddingBottom: 80 },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 28 },
    center: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, minHeight: 340 },

    // One frosted-glass pill (same track/segment language as the navbar's
    // own nav track and the language switcher's trigger) instead of two
    // separate bordered buttons floating around a bare label — reads as one
    // cohesive control rather than three unrelated pieces.
    pagination: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 4,
        marginTop: 40,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        padding: 6,
    } as object,
    // Faint resting-state tint (not just on focus) so Previous/Next read as
    // their own pressable zones at a glance — a TV remote user scanning the
    // screen before navigating onto this control has no cursor to hover
    // with, so the buttons need to look distinct from the label between
    // them even before focus ever lands here.
    pageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 18,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    pageButtonText: { fontSize: 14, fontWeight: '700' },
    pageLabel: { fontSize: 14, fontWeight: '600', paddingHorizontal: 16, textAlign: 'center' },
    pageDivider: { width: 1, height: 20 },
});
