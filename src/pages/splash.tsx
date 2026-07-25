import React, { useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext } from '../config';
import { useAuth } from '../store/auth';
import { storage, StorageKeys } from '../services/storage';

// Matches connekt-mobile's splash video behavior: advances when the video
// finishes, with a fallback timer in case playback stalls, plus tap-to-skip.
const FALLBACK_MS = 6500;

export default function SplashScreen() {
    const { theme } = useContext(ThemeContext);
    const router = useRouter();
    const status = useAuth((s) => s.status);
    const bootstrap = useAuth((s) => s.bootstrap);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const [destination, setDestination] = useState<string | null>(null);
    const [videoDone, setVideoDone] = useState(false);

    // Always attempt unmuted playback — no visible mute control by design.
    // On a real Smart TV app (Tizen/webOS/Android TV) this just plays with
    // sound; the only place it can silently fail is a general-purpose
    // desktop/mobile browser tab, which blocks autoplay-with-sound on a page
    // you haven't interacted with yet (a browser security policy, not
    // something fixable from app code). If that happens here the video
    // still plays, just without audio, rather than not playing at all.
    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.muted = false;
        el.play().catch(() => {
            el.muted = true;
            el.play().catch(() => {});
        });
    }, []);

    useEffect(() => {
        if (status === 'idle') bootstrap();
    }, [status, bootstrap]);

    // Resolve where we're headed as soon as auth status settles, but don't
    // navigate yet — that waits on the video (below).
    useEffect(() => {
        if (status !== 'authenticated' && status !== 'unauthenticated') return;
        let cancelled = false;
        (async () => {
            if (status === 'authenticated') {
                if (!cancelled) setDestination('/profiles');
                return;
            }
            const seen = await storage.get(StorageKeys.onboardingSeen);
            if (!cancelled) setDestination(seen ? '/login' : '/onboarding');
        })();
        return () => {
            cancelled = true;
        };
    }, [status]);

    // Fallback: don't let a stalled/failed video keep the app on splash forever.
    useEffect(() => {
        const timer = setTimeout(() => setVideoDone(true), FALLBACK_MS);
        return () => clearTimeout(timer);
    }, []);

    // Navigate once both the destination is known AND the video is done
    // (or the fallback/skip fired).
    useEffect(() => {
        if (destination && videoDone) router.replace(destination);
    }, [destination, videoDone, router]);

    const skip = () => setVideoDone(true);

    return (
        <View style={[styles.container, { backgroundColor: theme.static.colorBgPrimary }]} onTouchStart={skip}>
            <video
                ref={videoRef}
                src="/images/splash.mp4"
                playsInline
                onEnded={() => setVideoDone(true)}
                onError={() => setVideoDone(true)}
                onClick={skip}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: '100vh',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    } as object,
});
