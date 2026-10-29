import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { midnightGlass } from '../components/glass/glassStyle';
import { useRouter } from 'next/router';
import { ThemeContext } from '../config';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { FocusableCard } from '../components/FocusableCard';
import { OnScreenKeyboard } from '../components/OnScreenKeyboard';
import { useFocusNav } from '../hooks/useFocusNav';
import { useWindowWidth } from '../hooks/useWindowWidth';
import { fetchEventsPage, TvVideo } from '../api/catalog';
import { useTranslation } from '../i18n';
import { getStatusBadge } from '../utils/statusBadge';

const PAGE_SIZE = 12;
// 2, not 3 — the results column is narrower now that it sits beside the
// input/keyboard instead of spanning the full page width, and 3 columns
// made each card too small to read comfortably.
const GRID_COLUMNS = 2;
const GRID_GAP = 24;
// Landscape, not portrait - see Row.tsx's CARD_ASPECT_RATIO comment for why.
const CARD_ASPECT_RATIO = 3 / 4;
const FALLBACK_CARD_WIDTH = 240;
// Must match styles.mainContent's horizontal padding below.
const CONTENT_HORIZONTAL_PADDING = 48;
// Fixed rather than flex — sized to comfortably fit the on-screen keyboard
// (10 keys x 48px + 9x10px gaps ≈ 570px, see OnScreenKeyboard.tsx) plus its
// own padding, so the keyboard never gets clipped or forces this column
// wider than the results column can afford to give up.
const LEFT_COL_WIDTH = 620;
const COLUMN_GAP = 48;
// useWindowWidth reads window.innerWidth, which includes the vertical
// scrollbar's width in Chrome — the actual flex row (inside the scrollable
// area) renders a little narrower than that. Sizing cards to an exact-fit
// width with zero slack meant that gap alone was sometimes enough to push
// the last card in a row to overflow and wrap, leaving the rest of the row
// empty. This margin guarantees real breathing room.
const SAFETY_MARGIN = 32;
// Waits for typing to pause before hitting the backend — this searches the
// full public event catalog server-side (title/description/location/tags,
// live+upcoming+ended), not just the small live/upcoming slice the home rows
// keep client-side, so it shouldn't fire on every keystroke.
const DEBOUNCE_MS = 400;
// Suggestions update much faster than the full results grid (200ms vs
// 400ms, and a tiny page size) — they're meant to feel like they're
// tracking each keystroke almost live, not waiting for a full search.
const SUGGESTION_DEBOUNCE_MS = 200;
const SUGGESTION_LIMIT = 5;

export default function SearchScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();

    const [rawQuery, setRawQuery] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [videos, setVideos] = useState<TvVideo[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(false);
    // Keyboard only appears once the input is actually focused — not on
    // blur, since tapping a keyboard key itself blurs the TextInput (that
    // would make the keyboard vanish the instant you tried to use it).
    // Same pattern as login.tsx's remote-input tab; without this a TV
    // remote (no physical keyboard) has no way to type into this field at all.
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [suggestions, setSuggestions] = useState<TvVideo[]>([]);

    const onKeyPress = (key: string) => {
        if (key === 'BACKSPACE') {
            setRawQuery((v) => v.slice(0, -1));
        } else if (key === 'SPACE') {
            setRawQuery((v) => v + ' ');
        } else {
            setRawQuery((v) => v + key);
        }
    };

    // Results column is everything left over after the fixed-width input/
    // keyboard column and the gap between them — not the full page width,
    // now that results sit beside that column instead of below it.
    const windowWidth = useWindowWidth();
    const rightColWidth = windowWidth - CONTENT_HORIZONTAL_PADDING * 2 - LEFT_COL_WIDTH - COLUMN_GAP;
    const columnGap = GRID_GAP + 16;
    const cardWidth =
        rightColWidth > 0
            ? Math.floor((rightColWidth - SAFETY_MARGIN - columnGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
            : FALLBACK_CARD_WIDTH;
    const cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO);

    // Debounce: only commit rawQuery -> query (which triggers the real
    // fetch) once typing pauses, and always reset back to page 1 for a new
    // search term.
    useEffect(() => {
        const handle = setTimeout(() => {
            setQuery(rawQuery.trim());
            setPage(0);
        }, DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [rawQuery]);

    // Word-per-word suggestions dropdown, separate from the debounced full
    // grid below — a short list of matching titles that tracks typing
    // almost live, so there's something to see well before the fuller
    // search (and its longer debounce) resolves.
    useEffect(() => {
        const trimmed = rawQuery.trim();
        if (!trimmed) {
            setSuggestions([]);
            return;
        }
        let active = true;
        const handle = setTimeout(() => {
            fetchEventsPage(0, SUGGESTION_LIMIT, 'ALL', trimmed)
                .then((res) => active && setSuggestions(res.videos))
                .catch(() => active && setSuggestions([]));
        }, SUGGESTION_DEBOUNCE_MS);
        return () => {
            active = false;
            clearTimeout(handle);
        };
    }, [rawQuery]);

    useEffect(() => {
        if (!query) {
            setVideos([]);
            setTotalPages(1);
            setTotalElements(0);
            setLoading(false);
            return;
        }
        let active = true;
        setLoading(true);
        fetchEventsPage(page, PAGE_SIZE, 'ALL', query)
            .then((res) => {
                if (!active) return;
                setVideos(res.videos);
                setTotalPages(Math.max(1, res.totalPages));
                setTotalElements(res.totalElements);
            })
            .catch(() => active && setVideos([]))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [query, page]);

    const statusStrings = {
        liveNow: strings.detail.liveNow,
        startingSoon: strings.detail.startingSoon,
        cancelled: strings.detail.cancelled,
        ended: strings.detail.ended,
    };

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mainContent}>
                <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{strings.search.title}</Text>

                <View style={styles.columns}>
                    <View style={{ width: LEFT_COL_WIDTH }}>
                        <View
                            style={[
                                styles.inputWrap,
                                styles.glass,
                                { borderColor: keyboardVisible ? theme.static.colorFocusRing : theme.static.colorBorder },
                            ]}
                        >
                            <i className="bi bi-search" style={{ fontSize: 18, color: theme.static.colorTextSecondary }} />
                            <TextInput
                                value={rawQuery}
                                onChangeText={setRawQuery}
                                onFocus={() => setKeyboardVisible(true)}
                                placeholder={strings.search.placeholder}
                                placeholderTextColor={theme.static.colorTextSecondary}
                                hasTVPreferredFocus
                                style={[styles.input, { color: theme.static.colorTextPrimary }]}
                            />
                            {rawQuery ? (
                                <TouchableOpacity onPress={() => setRawQuery('')} style={styles.clearButton}>
                                    <i className="bi bi-x-circle-fill" style={{ fontSize: 16, color: theme.static.colorTextSecondary }} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Normal document flow, not floated over the keyboard — an
                            absolutely-positioned version looked "clean" in isolation
                            but visually collided with the keyboard's own top row
                            underneath it. Pushing the keyboard down instead is a
                            little more motion, but never looks broken. */}
                        {keyboardVisible && rawQuery.trim() && suggestions.length > 0 ? (
                            <View style={[styles.suggestionsBox, styles.glass, { borderColor: theme.static.colorBorder }]}>
                                {suggestions.map((s) => (
                                    <SuggestionRow
                                        key={s.id}
                                        title={s.title}
                                        onPress={() => {
                                            setKeyboardVisible(false);
                                            router.push(`/detail?id=${s.id}`);
                                        }}
                                    />
                                ))}
                            </View>
                        ) : null}

                        {keyboardVisible ? (
                            <View style={styles.keyboardWrap}>
                                <OnScreenKeyboard onKeyPress={onKeyPress} onDone={() => setKeyboardVisible(false)} />
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.rightCol}>
                        {!query ? (
                            <View style={styles.emptyState}>
                                <View style={[styles.emptyIconCircle, { backgroundColor: theme.static.colorSurfaceMuted }]}>
                                    <i className="bi bi-search" style={{ fontSize: 30, color: theme.static.colorAccent }} />
                                </View>
                                <Text style={[styles.emptyText, { color: theme.static.colorTextSecondary }]}>
                                    {strings.search.idleHint}
                                </Text>
                            </View>
                        ) : loading ? (
                            <View style={styles.center}>
                                <ActivityIndicator size="large" color={theme.static.colorAccent} />
                            </View>
                        ) : videos.length === 0 ? (
                            <View style={styles.emptyState}>
                                <View style={[styles.emptyIconCircle, { backgroundColor: theme.static.colorSurfaceMuted }]}>
                                    <i className="bi bi-emoji-frown" style={{ fontSize: 30, color: theme.static.colorAccent }} />
                                </View>
                                <Text style={[styles.emptyText, { color: theme.static.colorTextSecondary }]}>
                                    {strings.search.noResultsPrefix} "{query}"
                                </Text>
                            </View>
                        ) : (
                            <>
                                <Text style={[styles.resultsCount, { color: theme.static.colorTextSecondary }]}>
                                    {totalElements} {strings.search.resultsForQuery} "{query}"
                                </Text>

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
                            </>
                        )}
                    </View>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

function SuggestionRow({ title, onPress }: { title: string; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.suggestionRow, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <i className="bi bi-search" style={{ fontSize: 13, color: focused ? '#fff' : theme.static.colorTextSecondary }} />
            <Text numberOfLines={1} style={[styles.suggestionText, { color: focused ? '#fff' : theme.static.colorTextPrimary }]}>
                {title}
            </Text>
        </TouchableOpacity>
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
    mainContent: {
        padding: 48,
        paddingBottom: 80,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 24,
    },
    // Input/keyboard column stays fixed-width and pinned to the left;
    // results live beside it instead of below it, so they're visible (and
    // update live while debouncing) without the keyboard pushing them
    // off-screen underneath itself.
    columns: { flexDirection: 'row', gap: COLUMN_GAP, alignItems: 'flex-start' },
    rightCol: { flex: 1 },
    // Frosted-glass pill (same treatment as the events page's filter track
    // and the login screen's own cards) instead of a flat bordered box —
    // matches the rest of the app's input/card language.
    glass: midnightGlass as object,
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 999,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    // The browser's own default input focus outline is suppressed globally
    // in _document.tsx (inline style props on this TextInput don't reliably
    // reach the underlying <input> element) — this pill's own borderColor
    // change is the only focus indicator needed.
    input: {
        flex: 1,
        paddingVertical: 18,
        fontSize: 18,
    },
    clearButton: { padding: 4 },
    suggestionsBox: {
        borderRadius: 14,
        paddingVertical: 6,
        marginBottom: 16,
    } as object,
    suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 18 },
    suggestionText: { fontSize: 14, fontWeight: '600', flex: 1 },
    keyboardWrap: { marginBottom: 32 },
    resultsCount: { fontSize: 14, fontWeight: '600', marginBottom: 20 },
    center: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, minHeight: 340 },
    emptyState: { alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 },
    emptyIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 16, maxWidth: 420, textAlign: 'center' },
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
