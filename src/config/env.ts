/**
 * Central app configuration.
 *
 * No secrets here — anything bundled ships to the device. Secrets stay on
 * the amoria-connect backend.
 *
 * DEFAULT = production backend, on purpose. The native TV engines (Android TV
 * / Apple TV via React Native) do NOT inline `process.env.NEXT_PUBLIC_*` —
 * that's a Next.js/web-only mechanism fed by `.env.local`. So a native store
 * build never sees the env var and falls through to this default. It must be
 * the real backend, or the shipped TV app would silently hit localhost and
 * fail to load anything.
 *
 * For LOCAL dev against a local backend, set NEXT_PUBLIC_API_BASE_URL (e.g.
 * http://localhost:8080/api/remote) in `.env.local` — the web/dev engine
 * reads it and overrides the production default below.
 */

export const env = {
    /** Base URL of the amoria-connect (Spring Boot) API, including /api/remote. */
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://backend.connekyt.com/api/remote',

    /** Network request timeout in milliseconds. */
    requestTimeoutMs: 20_000,

    isDev: process.env.NODE_ENV !== 'production',
} as const;
