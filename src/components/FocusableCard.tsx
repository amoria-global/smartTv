import React, { useContext, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { useTranslation } from '../i18n';
import { formatDateBadge } from '../utils/date';
import { parseEventStart, formatShortCountdown } from '../utils/countdown';
import { isBookmarked, toggleBookmark } from '../features/bookmarks/api';
import type { UiEventStatus } from '../api/catalog';

type Badge = { label: string; color: string; live?: boolean };

type Props = {
    /** Required so the card can save/unsave itself in "My List" — every real event has one. */
    eventId: string;
    title: string;
    image?: string;
    onPress: () => void;
    width?: number;
    height?: number;
    hasTVPreferredFocus?: boolean;
    badge?: Badge;
    /** Real event fields — all optional since not every card context has them (e.g. search results). */
    eventDate?: string;
    startTime?: string;
    location?: string;
    hostName?: string;
    streamFee?: number;
    streamFeeCurrencySymbol?: string;
    status?: UiEventStatus;
};

export function FocusableCard({
    eventId,
    title,
    image,
    onPress,
    width = 320,
    height = 240,
    hasTVPreferredFocus,
    badge,
    eventDate,
    startTime,
    location,
    hostName,
    streamFee,
    streamFeeCurrencySymbol,
    status,
}: Props) {
    const { theme } = useContext(ThemeContext);
    const { strings, locale } = useTranslation();
    const { focused, focusProps } = useFocusNav();
    const [saved, setSaved] = useState(false);
    // Image renders nothing on load failure otherwise (same class of bug
    // fixed for the navbar avatar) — an unreachable/404 photo URL left the
    // whole card body a blank void instead of falling back to the same
    // "No image yet" placeholder a genuinely missing `image` prop gets.
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        let active = true;
        isBookmarked(eventId).then((v) => active && setSaved(v));
        return () => {
            active = false;
        };
    }, [eventId]);

    useEffect(() => {
        setImageError(false);
    }, [image]);

    // Compact "starts in" countdown for upcoming cards. Ticks once a MINUTE
    // (not per second) — a card grid can hold many of these, and minute
    // granularity is plenty at a glance while keeping TV re-renders cheap.
    const isUpcoming = status === 'UPCOMING';
    const [nowTs, setNowTs] = useState(() => Date.now());
    useEffect(() => {
        if (!isUpcoming) return;
        const t = setInterval(() => setNowTs(Date.now()), 60000);
        return () => clearInterval(t);
    }, [isUpcoming]);
    const startsAt = isUpcoming ? parseEventStart(eventDate, startTime) : null;
    const countdownMs = startsAt ? startsAt.getTime() - nowTs : 0;
    const countdownLabel = isUpcoming && countdownMs > 0 ? formatShortCountdown(countdownMs) : null;

    const onToggleBookmark = async (e: { stopPropagation?: () => void }) => {
        // Nested TouchableOpacity inside the card's own TouchableOpacity — on
        // web these render to real DOM elements where clicks bubble, so
        // without this a bookmark tap would also fire the card's onPress
        // (navigating to the detail page instead of just toggling the save).
        e.stopPropagation?.();
        const nowSaved = await toggleBookmark({
            id: eventId,
            title,
            imageUrl: image,
            eventDate,
            startTime,
            location,
            hostName,
            streamFee,
            streamFeeCurrencySymbol,
            status,
        });
        setSaved(nowSaved);
    };

    const dateBadge = formatDateBadge(eventDate, locale);
    const priceLabel =
        streamFee && streamFee > 0
            ? `${strings.common.fromPricePrefix} ${streamFeeCurrencySymbol ?? ''}${streamFee}`
            : strings.common.free;

    const borderColor = focused
        ? theme.static.colorFocusRing
        : badge?.live
          ? theme.static.colorError
          : theme.static.colorBorder;

    return (
        <TouchableOpacity
            onPress={onPress}
            hasTVPreferredFocus={hasTVPreferredFocus}
            {...focusProps}
            style={[
                styles.card,
                { width, height, borderColor, backgroundColor: theme.static.colorSurface },
                focused && { transform: [{ scale: 1.04 }] },
            ]}
        >
            {image && !imageError ? (
                <Image source={{ uri: image }} style={styles.image} resizeMode="cover" onError={() => setImageError(true)} />
            ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: theme.static.colorSurfaceMuted }]}>
                    <i className="bi bi-image" style={{ fontSize: 44, color: theme.static.colorTextSecondary }} />
                    <Text style={[styles.imagePlaceholderText, { color: theme.static.colorTextSecondary }]}>
                        {strings.common.noImage}
                    </Text>
                </View>
            )}

            {dateBadge ? (
                <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeMonth}>{dateBadge.month}</Text>
                    <Text style={styles.dateBadgeDay}>{dateBadge.day}</Text>
                </View>
            ) : null}

            <View style={styles.topRightRow}>
                {badge ? (
                    <View style={[styles.statusPill, { backgroundColor: badge.color }]}>
                        {badge.live ? <View style={styles.liveDot} /> : null}
                        <Text style={styles.statusPillText}>{badge.label}</Text>
                    </View>
                ) : null}
                <TouchableOpacity onPress={onToggleBookmark} style={styles.bookmarkButton}>
                    <i className={`bi ${saved ? 'bi-bookmark-fill' : 'bi-bookmark'}`} style={{ fontSize: 13, color: '#fff' }} />
                </TouchableOpacity>
            </View>

            <View style={styles.scrim}>
                {countdownLabel ? (
                    <View style={styles.countdownChip}>
                        <i className="bi bi-hourglass-split" style={{ fontSize: 10, color: '#fff' }} />
                        <Text style={styles.countdownChipText}>
                            {strings.detail.startsIn} {countdownLabel}
                        </Text>
                    </View>
                ) : null}

                {location ? (
                    <View style={styles.locationRow}>
                        <i className="bi bi-geo-alt-fill" style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }} />
                        <Text numberOfLines={1} style={styles.locationText}>
                            {location}
                        </Text>
                    </View>
                ) : null}

                <Text numberOfLines={2} style={styles.title}>
                    {title}
                </Text>

                <View style={styles.bottomRow}>
                    {hostName ? (
                        <View style={styles.hostChip}>
                            <View style={styles.hostAvatar}>
                                <i className="bi bi-person-fill" style={{ fontSize: 10, color: '#fff' }} />
                            </View>
                            <Text numberOfLines={1} style={styles.hostName}>
                                {hostName}
                            </Text>
                        </View>
                    ) : (
                        <View />
                    )}
                    <View style={[styles.priceChip, { backgroundColor: theme.static.colorAccent }]}>
                        <i className="bi bi-tag-fill" style={{ fontSize: 10, color: '#fff' }} />
                        <Text style={styles.priceText}>{priceLabel}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        borderWidth: 2,
        marginRight: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    image: { ...StyleSheet.absoluteFillObject } as object,
    imagePlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8 } as object,
    imagePlaceholderText: { fontSize: 12, fontWeight: '600' },

    dateBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    dateBadgeMonth: { color: '#0B0B10', fontSize: 9, fontWeight: '800' },
    dateBadgeDay: { color: '#0B0B10', fontSize: 13, fontWeight: '800' },

    topRightRow: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 9,
    },
    liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
    statusPillText: { color: '#fff', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
    bookmarkButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    scrim: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 12,
        paddingTop: 40,
        backgroundImage: 'linear-gradient(180deg, rgba(11,11,16,0), rgba(11,11,16,0.65) 40%, rgba(11,11,16,0.95))',
    } as object,
    countdownChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5,
        marginBottom: 8,
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: 'rgba(242,12,143,0.9)',
    },
    countdownChipText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    locationText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, flex: 1 },
    title: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 10, lineHeight: 19 },

    bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    hostChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    hostAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    hostName: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', flexShrink: 1 },
    priceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 },
    priceText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
