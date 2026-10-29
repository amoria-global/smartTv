import React, { useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { midnightGlass } from './glass/glassStyle';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { fetchChatMessages, StreamChatMessage } from '../features/events/api';

/**
 * Read-only live chat feed for the TV - composing a reply happens on the
 * viewer's phone (QR below the feed opens the same public livestream page
 * the gift flow already uses, which has a full chat composer) rather than
 * typing a comment with a remote's on-screen keyboard. Polls the same
 * `/chats` endpoint the reactions overlay does, just the text-message bucket
 * instead of the reaction bucket.
 */
export function ChatPanel({ eventId, chatUrl, onClose }: { eventId: string; chatUrl: string; onClose: () => void }) {
    const { theme } = useContext(ThemeContext);
    const [messages, setMessages] = useState<StreamChatMessage[]>([]);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        let cancelled = false;
        const poll = async () => {
            const rows = await fetchChatMessages(eventId, 30);
            if (!cancelled) setMessages(rows);
        };
        poll();
        const timer = setInterval(poll, 3_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [eventId]);

    return (
        <View style={[styles.panel, midnightGlass as object]}>
            <View style={styles.header}>
                <Text style={[styles.headerText, { color: theme.static.colorTextPrimary }]}>Live Chat</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <i className="bi bi-x-lg" style={{ fontSize: 14, color: '#fff' }} />
                </TouchableOpacity>
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.feed}
                contentContainerStyle={styles.feedContent}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
                {messages.length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.static.colorTextSecondary }]}>
                        No messages yet — be the first to say something.
                    </Text>
                ) : (
                    messages.map((m) => (
                        <View key={m.id} style={styles.bubble}>
                            <Text style={[styles.bubbleName, { color: theme.static.colorPrimaryLight }]}>{m.viewerUsername ?? 'Viewer'}</Text>
                            <Text style={[styles.bubbleMessage, { color: theme.static.colorTextPrimary }]}>{m.message}</Text>
                        </View>
                    ))
                )}
            </ScrollView>

            <View style={[styles.replyRow, { borderColor: theme.static.colorBorder }]}>
                <View style={styles.replyQrBox}>
                    <QRCodeSVG value={chatUrl} size={72} bgColor="#FFFFFF" fgColor="#0A1220" level="M" />
                </View>
                <Text style={[styles.replyText, { color: theme.static.colorTextSecondary }]}>
                    Scan to reply from your phone
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 340,
        borderLeftWidth: 1,
        zIndex: 5,
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
    },
    headerText: { fontSize: 16, fontWeight: '800' },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 9999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    feed: { flex: 1 },
    feedContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
    emptyText: { fontSize: 13, textAlign: 'center', marginTop: 24 },
    bubble: { gap: 2 },
    bubbleName: { fontSize: 12, fontWeight: '700' },
    bubbleMessage: { fontSize: 14, lineHeight: 19 },
    replyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
    },
    replyQrBox: {
        width: 72,
        height: 72,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    replyText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
