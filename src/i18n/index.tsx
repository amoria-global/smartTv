import React, { createContext, useContext, useEffect, useState } from 'react';
import en, { Strings } from './en';
import fr from './fr';
import rw from './rw';
import { storage, StorageKeys } from '../services/storage';

export type Locale = 'en' | 'fr' | 'rw';

// No flag emoji here on purpose — flag glyphs are two combined Unicode
// regional-indicator code points, and several smart TV browsers/WebViews
// don't ship a color-emoji font capable of merging them, rendering broken
// fallback glyphs (a stray circle, or two separate boxed letters) instead
// of an actual flag. bi-globe2 (a real webfont icon, not an emoji) is used
// everywhere this used to render a flag instead.
export const LOCALES: { code: Locale; label: string; short: string }[] = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'rw', label: 'Kinyarwanda', short: 'KIN' },
];

const DICTIONARIES: Record<Locale, Strings> = { en, fr, rw };

function isLocale(v: string | null): v is Locale {
    return v === 'en' || v === 'fr' || v === 'rw';
}

type I18nContextValue = {
    locale: Locale;
    strings: Strings;
    setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue>({
    locale: 'en',
    strings: DICTIONARIES.en,
    setLocale: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');

    useEffect(() => {
        storage.get(StorageKeys.locale).then((saved) => {
            if (isLocale(saved)) setLocaleState(saved);
        });
    }, []);

    const setLocale = (next: Locale) => {
        setLocaleState(next);
        storage.set(StorageKeys.locale, next);
    };

    return (
        <I18nContext.Provider value={{ locale, strings: DICTIONARIES[locale], setLocale }}>
            {children}
        </I18nContext.Provider>
    );
}

/** `strings` is the whole current-locale dictionary, e.g. `strings.settings.logOut`. */
export function useTranslation() {
    return useContext(I18nContext);
}
