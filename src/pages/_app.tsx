import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/fonts.css';
import '../styles/animations.css';
import { ThemeProvider } from '../config';
import { I18nProvider } from '../i18n';
import { AssistantOverlay } from '../features/assistant/AssistantOverlay';
import { initSpatialNavigation } from '../utils/spatialNavigation';
import { initBackHandler } from '../utils/backHandler';
import { useSentEvents } from '../features/tv/useSentEvents';

export default function MyApp({ Component, pageProps }) {
    const router = useRouter();

    // Real D-pad spatial navigation for the TV remote — one global handler,
    // client-only. Every screen's Touchables are already focusable, so this
    // needs no per-component wiring (see utils/spatialNavigation).
    useEffect(() => initSpatialNavigation(), []);

    // Send to TV: opens the player when the phone sends an event to this TV.
    useSentEvents();

    // TV remote Back/Return key. Open modals register their own close via
    // useBackHandler and take priority; with none open, Back navigates back.
    // Guarded so it never reverses past the app's own first screen into
    // browser history that isn't ours.
    useEffect(
        () =>
            initBackHandler(() => {
                if (window.history.length > 1) router.back();
            }),
        [router],
    );

    return (
        <ThemeProvider>
            <Head>
                {/* Tab title and icons. The icon files are the same ones connekyt.com uses, so the tab
                    looks the same on both. The ?v=2 query makes browsers refetch the icon instead of
                    reusing the one they cached while this site had none. */}
                <title>Connekyt TV</title>
                <meta name="theme-color" content="#0A1426" />
                <link rel="icon" href="/favicon.ico?v=2" sizes="48x48" type="image/x-icon" />
                <link rel="icon" type="image/png" sizes="32x32" href="/images/icon-32.png?v=2" />
                <link rel="icon" type="image/png" sizes="192x192" href="/images/icon-192.png?v=2" />
                <link rel="apple-touch-icon" href="/images/apple-touch-icon.png?v=2" />
            </Head>
            <I18nProvider>
                <Component {...pageProps} />
                <AssistantOverlay />
            </I18nProvider>
        </ThemeProvider>
    );
}
