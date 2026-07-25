/**
 * Central app configuration.
 *
 * No secrets here — anything bundled ships to the device. Secrets stay on
 * the amoria-connect backend.
 *
 * Points at the local amoria-connect backend for now. Override via
 * NEXT_PUBLIC_API_BASE_URL if it's not on localhost:8080.
 */

export const env = {
    /** Base URL of the amoria-connect (Spring Boot) API, including /api/remote. */
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/remote',

    /** Network request timeout in milliseconds. */
    requestTimeoutMs: 20_000,

    isDev: process.env.NODE_ENV !== 'production',
} as const;
