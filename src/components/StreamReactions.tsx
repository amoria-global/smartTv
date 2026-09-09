import React, { useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { fetchRecentReactions, fetchViewerCount, sendReaction } from '../features/events/api';
import { getTvDeviceId } from '../services/deviceId';

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👏', '😮'];
// How long a floating reaction takes to rise and fade - matches the
// transition duration set on FloatingReaction below.
const FLOAT_DURATION_MS = 2600;

type FloatingItem = { key: string; emoji: string; left: number };

/**
 * Polls the same public reactions/viewer-count endpoints knockout's web
 * player uses (see amoria-connect PublicRemoteController) and drives the
 * floating-emoji effect for this TV. `active` should be false while a gate
 * (invite/pay) is open or the event isn't actually live - no point polling
 * for a stream nobody's watching yet.
 */
function useStreamReactions(eventId: string | undefined, active: boolean) {
    const [viewerCount, setViewerCount] = useState(0);
    const [floating, setFloating] = useState<FloatingItem[]>([]);
    const seenIds = useRef(new Set<string>());
    const deviceIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!eventId || !active) return undefined;
        let cancelled = false;

        const pollViewers = async () => {
            const count = await fetchViewerCount(eventId);
            if (!cancelled) setViewerCount(count);
        };
        pollViewers();
        const timer = setInterval(pollViewers, 12_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [eventId, active]);

    useEffect(() => {
        if (!eventId || !active) return undefined;
        let cancelled = false;

        const pollReactions = async () => {
            const rows = await fetchRecentReactions(eventId, 20);
            if (cancelled) return;
            const fresh = rows.filter((r) => r.id && !seenIds.current.has(r.id));
            if (!fresh.length) return;
            fresh.forEach((r) => seenIds.current.add(r.id));

            const additions: FloatingItem[] = fresh.map((r) => ({
                key: r.id,
                emoji: r.message,
                left: 12 + Math.random() * 70,
            }));
            setFloating((prev) => [...prev, ...additions]);
            additions.forEach((a) => {
                setTimeout(() => setFloating((prev) => prev.filter((f) => f.key !== a.key)), FLOAT_DURATION_MS);
            });
        };
        pollReactions();
        const timer = setInterval(pollReactions, 2_500);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [eventId, active]);

    const sendEmoji = async (emoji: string) => {
        if (!eventId) return;
        if (!deviceIdRef.current) deviceIdRef.current = await getTvDeviceId();
        sendReaction(eventId, emoji, deviceIdRef.current);
    };

    return { viewerCount, floating, sendEmoji };
}

export { useStreamReactions };

/** Absolutely-positioned layer of rising/fading emojis over the video. */
export function FloatingReactionsOverlay({ items }: { items: FloatingItem[] }) {
    return (
        <View style={styles.floatingLayer} pointerEvents="none">
            {items.map((item) => (
                <FloatingReaction key={item.key} emoji={item.emoji} left={item.left} />
            ))}
        </View>
    );
}

function FloatingReaction({ emoji, left }: { emoji: string; left: number }) {
    // Mounts at the bottom, then immediately animates up + fades - a plain
    // CSS transition (same technique the rest of the app uses for hover/focus
    // transforms) rather than RN's Animated API, which this codebase doesn't
    // use anywhere else.
    const [risen, setRisen] = useState(false);
    useEffect(() => {
        const raf = requestAnimationFrame(() => setRisen(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <Text
            style={[
                styles.floatingEmoji,
                { left: `${left}%` },
                {
                    transition: `transform ${FLOAT_DURATION_MS}ms ease-out, opacity ${FLOAT_DURATION_MS}ms ease-in`,
                    transform: risen ? [{ translateY: -280 }] : [{ translateY: 0 }],
                    opacity: risen ? 0 : 1,
                } as object,
            ]}
        >
            {emoji}
        </Text>
    );
}

/** Row of one-tap emoji reactions - no typing, so it works fine with a
 *  remote (unlike free-text chat, which is better handed off to a phone). */
export function ReactionBar({ onSend }: { onSend: (emoji: string) => void }) {
    return (
        <View style={styles.reactionBar}>
            {REACTION_EMOJIS.map((emoji) => (
                <ReactionButton key={emoji} emoji={emoji} onPress={() => onSend(emoji)} />
            ))}
        </View>
    );
}

function ReactionButton({ emoji, onPress }: { emoji: string; onPress: () => void }) {
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.reactionButton, focused && { backgroundColor: 'rgba(255,255,255,0.18)', transform: [{ scale: 1.12 }] }]}
        >
            <Text style={styles.reactionButtonEmoji}>{emoji}</Text>
        </TouchableOpacity>
    );
}

export function ViewerCountBadge({ count }: { count: number }) {
    const { theme } = useContext(ThemeContext);
    if (count <= 0) return null;
    return (
        <View style={[styles.viewerBadge, { backgroundColor: theme.static.colorSurface, borderColor: theme.static.colorBorder }]}>
            <i className="bi bi-eye-fill" style={{ fontSize: 12, color: theme.static.colorTextSecondary }} />
            <Text style={[styles.viewerBadgeText, { color: theme.static.colorTextPrimary }]}>{count.toLocaleString()}</Text>
        </View>
    );
}

/** Eye/eye-slash toggle for hiding the floating reactions overlay - a pure
 *  display preference for this viewer, not something that stops them from
 *  still sending reactions via the bar. */
export function HideReactionsButton({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.hideButton, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <i className={`bi ${hidden ? 'bi-eye-slash' : 'bi-eye'}`} style={{ fontSize: 16, color: '#fff' }} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    floatingLayer: { ...StyleSheet.absoluteFillObject, zIndex: 2 } as object,
    floatingEmoji: { position: 'absolute', bottom: 90, fontSize: 32 } as object,

    reactionBar: { flexDirection: 'row', gap: 10 },
    reactionButton: {
        width: 44,
        height: 44,
        borderRadius: 9999,
        backgroundColor: 'rgba(21,21,28,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reactionButtonEmoji: { fontSize: 20 },

    viewerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    viewerBadgeText: { fontSize: 13, fontWeight: '700' },

    hideButton: {
        width: 40,
        height: 40,
        borderRadius: 9999,
        backgroundColor: 'rgba(21,21,28,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
