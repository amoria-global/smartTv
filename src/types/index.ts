/**
 * Shared, app-wide types. Feature-specific types live in their feature folder.
 *
 * The amoria-connect backend wraps responses in an `action` envelope:
 *   { action: 1, message, data }   // action === 1 means success
 * Auth endpoints return a flatter shape (token fields at the top level).
 */

/** Standard envelope returned by most /api/remote endpoints. */
export type ApiEnvelope<T> = {
    action: number; // 1 = success, 0 = failure, 2 = 2FA required (auth)
    message?: string;
    data?: T;
};

/** Error surfaced to the UI. */
export type ApiError = {
    status: number;
    message: string;
    fieldErrors?: Record<string, string>;
};

export type ID = string;

export type Paginated<T> = {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
};
