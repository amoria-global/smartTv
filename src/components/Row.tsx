import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ThemeContext } from '../config';
import { FocusableCard } from './FocusableCard';
import { UiEventStatus } from '../api/catalog';
import { useTranslation } from '../i18n';
import { useWindowWidth } from '../hooks/useWindowWidth';
import { getStatusBadge } from '../utils/statusBadge';

export type RowItem = {
    id: string;
    title: string;
    image?: string;
    status?: UiEventStatus;
    eventDate?: string;
    startTime?: string;
    location?: string;
    hostName?: string;
    streamFee?: number;
    streamFeeCurrencySymbol?: string;
};

type Props = {
    title: string;
    items: RowItem[];
    onSelect: (item: RowItem) => void;
    rowFocusIndex?: number; // give the first card of the first row initial TV focus
    /** How many cards should be fully visible across the screen width at once (still horizontally scrollable for the rest). */
    cardsPerRow?: number;
};

const HORIZONTAL_PADDING = 48;
const CARD_GAP = 16; // matches FocusableCard's own marginRight
// Landscape (width > height), not portrait - checked the actual uploaded
// event posters: they run from square (~1:1) to moderately wide (~1.6:1),
// never portrait. The old 320/240 (height > width) value forced a portrait
// frame onto landscape/square source images, so `resizeMode: cover` had to
// crop hard off the left/right edges to fill it - which is exactly what
// was slicing text off event posters (see FocusableCard's cover image).
const CARD_ASPECT_RATIO = 3 / 4; // height = 75% of width (4:3 landscape)
const FALLBACK_CARD_WIDTH = 240; // used only for the first render, before layout is measured

export function Row({ title, items, onSelect, rowFocusIndex, cardsPerRow = 4 }: Props) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    // window.innerWidth (not RN's onLayout, which never fires for this View
    // in this react-native-web setup — see useWindowWidth) is what makes
    // "N cards fit on screen" actually hold regardless of window size,
    // instead of every card silently sitting at FALLBACK_CARD_WIDTH forever.
    const windowWidth = useWindowWidth();
    if (!items.length) return null;

    const availableWidth = windowWidth - HORIZONTAL_PADDING * 2;
    const cardWidth = availableWidth > 0
        ? Math.floor((availableWidth - CARD_GAP * (cardsPerRow - 1)) / cardsPerRow)
        : FALLBACK_CARD_WIDTH;
    const cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO);

    const statusStrings = {
        liveNow: strings.detail.liveNow,
        startingSoon: strings.detail.startingSoon,
        cancelled: strings.detail.cancelled,
        ended: strings.detail.ended,
    };

    return (
        <View style={styles.wrap}>
            <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {items.map((item, i) => (
                    <FocusableCard
                        key={item.id}
                        eventId={item.id}
                        title={item.title}
                        image={item.image}
                        width={cardWidth}
                        height={cardHeight}
                        onPress={() => onSelect(item)}
                        hasTVPreferredFocus={rowFocusIndex === i}
                        badge={getStatusBadge(item.status, theme.static, statusStrings)}
                        eventDate={item.eventDate}
                        startTime={item.startTime}
                        location={item.location}
                        hostName={item.hostName}
                        streamFee={item.streamFee}
                        streamFeeCurrencySymbol={item.streamFeeCurrencySymbol}
                        status={item.status}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: 28 },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 14, paddingHorizontal: 48 },
    scroll: { paddingHorizontal: 48 },
});
