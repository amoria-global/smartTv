import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps the browser Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * for push-to-talk voice capture. Most Chromium-based TV browsers (Android
 * TV, some Tizen/webOS builds) support this; where it's missing, `supported`
 * is false and the caller should fall back to the existing OnScreenKeyboard
 * text-entry pattern (see player.tsx's InviteGate) instead of building a
 * separate server-side transcription pipeline.
 */

// Not in the standard TS DOM lib yet — narrow, local shape for just what's used.
type SpeechRecognitionLike = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceCapture(onResult: (transcript: string) => void) {
    const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const onResultRef = useRef(onResult);
    onResultRef.current = onResult;

    const start = useCallback(() => {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) return;

        const recognition = new Ctor();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1]?.[0]?.transcript;
            if (transcript) onResultRef.current(transcript.trim());
        };
        recognition.onerror = () => setListening(false);
        recognition.onend = () => setListening(false);

        recognitionRef.current = recognition;
        setListening(true);
        recognition.start();
    }, []);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    // Abort (not just stop) on unmount — a held-open recognition session
    // shouldn't keep listening after the overlay that owns it is gone.
    useEffect(() => () => recognitionRef.current?.abort(), []);

    return { supported, listening, start, stop };
}
