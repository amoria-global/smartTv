import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/fonts.css';
import '../styles/animations.css';
import { ThemeProvider } from '../config';
import { I18nProvider } from '../i18n';
import { AssistantOverlay } from '../features/assistant/AssistantOverlay';
import { initSpatialNavigation } from '../utils/spatialNavigation';
import { initBackHandler } from '../utils/backHandler';

export default function MyApp({ Component, pageProps }) {
    const router = useRouter();

    // Real D-pad spatial navigation for the TV remote — one global handler,
    // client-only. Every screen's Touchables are already focusable, so this
    // needs no per-component wiring (see utils/spatialNavigation).
    useEffect(() => initSpatialNavigation(), []);

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
            <I18nProvider>
                <Component {...pageProps} />
                <AssistantOverlay />
            </I18nProvider>
        </ThemeProvider>
    );
}
