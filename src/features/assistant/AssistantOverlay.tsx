import React, { useContext, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext } from '../../config';
import { useFocusNav } from '../../hooks/useFocusNav';
import { useBackHandler } from '../../hooks/useBackHandler';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { useTranslation } from '../../i18n';
import { useAssistant, AssistantAction } from '../../store/assistant';
import { usePlayerControls } from '../../store/playerControls';
import { Row, RowItem } from '../../components/Row';
import { OnScreenKeyboard } from '../../components/OnScreenKeyboard';
import type { TvVideo } from '../../api/catalog';
import { askAssistant } from './api';

function toRowItems(videos: TvVideo[]): RowItem[] {
    return videos.map((v) => ({
        id: v.id,
        title: v.title,
        image: v.imageUrl,
        status: v.status,
        eventDate: v.eventDate,
        location: v.location,
        hostName: v.hostName,
        streamFee: v.streamFee,
        streamFeeCurrencySymbol: v.streamFeeCurrencySymbol,
    }));
}

/**
 * Mounted once in _app.tsx (see that file) so it's reachable from every
 * screen via the `assistant` store, which the Navbar mic button writes to.
 * Push-to-talk lives entirely inside this component's own mic button
 * (press-and-hold starts SpeechRecognition, release sends) rather than
 * being triggered from Navbar, to avoid a cross-component mount-order race.
 */
export function AssistantOverlay() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const { open, messages, results, loading, closeOverlay, pushMessage, setResults, setLoading, reset } = useAssistant();
    const [draft, setDraft] = useState('');
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    // Back key closes the assistant overlay instead of navigating away.
    useBackHandler(() => closeOverlay(), open);

    const notPlaying = () => pushMessage({ role: 'assistant', text: strings.assistant.notWatchingAnything });

    const runAction = (action: AssistantAction) => {
        const controls = usePlayerControls.getState();
        switch (action.type) {
            case 'navigate_home':
                router.push('/home');
                break;
            case 'navigate_events':
                router.push('/events');
                break;
            case 'navigate_search':
                router.push('/search');
                break;
            case 'navigate_my_list':
                router.push('/my-list');
                break;
            case 'navigate_detail':
                if (action.eventId) router.push(`/detail?id=${action.eventId}`);
                break;
            case 'navigate_player':
                if (action.eventId) router.push(`/player?id=${action.eventId}`);
                break;
            case 'play':
                controls.video ? controls.video.play() : notPlaying();
                break;
            case 'pause':
                controls.video ? controls.video.pause() : notPlaying();
                break;
            case 'mute':
                controls.video ? (controls.video.muted = true) : notPlaying();
                break;
            case 'unmute':
                controls.video ? (controls.video.muted = false) : notPlaying();
                break;
            case 'toggle_fullscreen':
                controls.toggleFullscreen ? controls.toggleFullscreen() : notPlaying();
                break;
            case 'open_chat':
                controls.openChat ? controls.openChat() : notPlaying();
                break;
            case 'open_gift':
                controls.openGift ? controls.openGift() : notPlaying();
                break;
            case 'toggle_reactions':
                controls.toggleReactions ? controls.toggleReactions() : notPlaying();
                break;
        }
    };

    const submit = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;
        const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
        pushMessage({ role: 'user', text: trimmed });
        setDraft('');
        setLoading(true);
        try {
            const context = {
                screen: router.pathname.replace(/^\//, '') || 'home',
                eventId: typeof router.query.id === 'string' ? router.query.id : undefined,
            };
            const res = await askAssistant(trimmed, nextHistory, context);
            if (res.reply) pushMessage({ role: 'assistant', text: res.reply });
            setResults(res.results);
            if (res.action) runAction(res.action);
        } catch (err) {
            // Show the real reason when the server gave us one (e.g.
            // "Assistant is not configured") — falls back to the generic
            // copy only for genuine network-level failures (offline, DNS,
            // etc.), where there's no server message to show.
            const detail = err instanceof Error && err.message ? err.message : null;
            pushMessage({ role: 'assistant', text: detail ?? strings.assistant.errorGeneric });
        } finally {
            setLoading(false);
        }
    };

    const { supported: voiceSupported, listening, start, stop } = useVoiceCapture(submit);

    const close = () => {
        stop();
        closeOverlay();
        reset();
    };

    if (!open) return null;

    const placeholder = listening
        ? strings.assistant.listening
        : loading
          ? strings.assistant.thinking
          : voiceSupported
            ? strings.assistant.placeholder
            : strings.assistant.notSupportedNote;

    return (
        <View style={styles.overlay}>
            <View style={[styles.panel, { backgroundColor: theme.static.colorSurface, borderColor: theme.static.colorBorder }]}>
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{strings.assistant.title}</Text>
                        <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary }]}>{strings.assistant.subtitle}</Text>
                    </View>
                    <CloseButton onPress={close} label={strings.assistant.close} />
                </View>

                <ScrollView
                    ref={scrollRef}
                    style={styles.messages}
                    contentContainerStyle={styles.messagesContent}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.length === 0 ? (
                        <Text style={[styles.hint, { color: theme.static.colorTextSecondary }]}>{strings.assistant.emptyHint}</Text>
                    ) : (
                        messages.map((m, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.bubble,
                                    m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                                    { backgroundColor: m.role === 'user' ? theme.static.colorAccent : theme.static.colorSurfaceMuted },
                                ]}
                            >
                                <Text style={[styles.bubbleText, { color: m.role === 'user' ? '#fff' : theme.static.colorTextPrimary }]}>
                                    {m.text}
                                </Text>
                            </View>
                        ))
                    )}
                    {loading ? <ActivityIndicator size="small" color={theme.static.colorAccent} style={styles.loadingIndicator} /> : null}
                </ScrollView>

                {results.length ? (
                    <Row
                        title={strings.search.results}
                        items={toRowItems(results)}
                        cardsPerRow={3}
                        onSelect={(item) => {
                            close();
                            router.push(`/detail?id=${item.id}`);
                        }}
                    />
                ) : null}

                <View style={styles.inputRow}>
                    <MicButton listening={listening} supported={voiceSupported} onPressIn={start} onPressOut={stop} />
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        onFocus={() => setKeyboardVisible(true)}
                        onSubmitEditing={() => submit(draft)}
                        placeholder={placeholder}
                        placeholderTextColor={theme.static.colorTextSecondary}
                        editable={!loading}
                        style={[styles.input, { color: theme.static.colorTextPrimary, borderColor: theme.static.colorBorder }]}
                    />
                    <SendButton onPress={() => submit(draft)} disabled={!draft.trim() || loading} label={strings.assistant.send} />
                </View>

                {keyboardVisible ? (
                    <OnScreenKeyboard
                        onKeyPress={(key) => {
                            if (key === 'BACKSPACE') setDraft((d) => d.slice(0, -1));
                            else if (key === 'SPACE') setDraft((d) => d + ' ');
                            else setDraft((d) => d + key);
                        }}
                        onDone={() => setKeyboardVisible(false)}
                    />
                ) : null}
            </View>
        </View>
    );
}

function CloseButton({ onPress, label }: { onPress: () => void; label: string }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.closeButton, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <i className="bi bi-x-lg" style={{ fontSize: 14, color: '#fff' }} />
            <Text style={styles.closeButtonText}>{label}</Text>
        </TouchableOpacity>
    );
}

function MicButton({
    listening,
    supported,
    onPressIn,
    onPressOut,
}: {
    listening: boolean;
    supported: boolean;
    onPressIn: () => void;
    onPressOut: () => void;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={!supported}
            {...focusProps}
            style={[
                styles.micButton,
                { backgroundColor: listening ? theme.static.colorError : theme.static.colorAccent, opacity: supported ? 1 : 0.4 },
                focused && { transform: [{ scale: 1.08 }] },
            ]}
        >
            <i className={`bi ${listening ? 'bi-mic-fill' : 'bi-mic'}`} style={{ fontSize: 18, color: '#fff' }} />
        </TouchableOpacity>
    );
}

function SendButton({ onPress, disabled, label }: { onPress: () => void; disabled: boolean; label: string }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            {...focusProps}
            style={[
                styles.sendButton,
                { backgroundColor: disabled ? theme.static.colorSurfaceMuted : theme.static.colorAccent },
                focused && !disabled && { transform: [{ scale: 1.04 }] },
            ]}
        >
            <Text style={[styles.sendButtonText, { color: disabled ? theme.static.colorTextSecondary : '#fff' }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        zIndex: 50,
    } as object,
    panel: {
        width: 760,
        maxWidth: '92%',
        maxHeight: '86%',
        borderRadius: 20,
        borderWidth: 1,
        padding: 28,
    } as object,
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '800' },
    subtitle: { fontSize: 13, marginTop: 4 },
    closeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    closeButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    messages: { maxHeight: 260, marginBottom: 16 },
    messagesContent: { gap: 10, paddingBottom: 4 },
    hint: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },
    bubble: { maxWidth: '80%', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
    bubbleUser: { alignSelf: 'flex-end' },
    bubbleAssistant: { alignSelf: 'flex-start' },
    bubbleText: { fontSize: 14, lineHeight: 20 },
    loadingIndicator: { marginTop: 4, alignSelf: 'flex-start' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    micButton: { width: 48, height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
    sendButton: { borderRadius: 9999, paddingVertical: 12, paddingHorizontal: 20 },
    sendButtonText: { fontSize: 13, fontWeight: '800' },
});
