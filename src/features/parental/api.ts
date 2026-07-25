/**
 * Parental-control PIN that gates the Settings screen. Backed by
 * /api/remote/customer/parental-controls on amoria-connect — account-level,
 * so it applies on any TV signed into the account.
 */
import { api } from '../../api/client';

export async function fetchParentalControlEnabled(): Promise<boolean> {
    const res = await api.get<{ action: number; data?: { enabled?: boolean } }>('/customer/parental-controls');
    return res?.data?.enabled === true;
}

/** Verifies a PIN without mutating anything — used to unlock Settings. */
export async function verifyParentalPin(pin: string): Promise<boolean> {
    const res = await api.post<{ action: number; data?: { valid?: boolean } }>(
        '/customer/parental-controls/verify',
        { pin },
    );
    return res?.data?.valid === true;
}

/** Sets/changes the PIN. currentPin is required only when one is already set. */
export async function setParentalPin(newPin: string, currentPin?: string): Promise<{ ok: boolean; message?: string }> {
    const res = await api.put<{ action: number; message?: string }>('/customer/parental-controls', {
        newPin,
        ...(currentPin ? { currentPin } : {}),
    });
    return { ok: res.action === 1, message: res.message };
}

export async function disableParentalControl(currentPin: string): Promise<{ ok: boolean; message?: string }> {
    const res = await api.delete<{ action: number; message?: string }>('/customer/parental-controls', {
        body: { currentPin },
    });
    return { ok: res.action === 1, message: res.message };
}

/**
 * Event categories hidden from browsing on this account — not a separate
 * resource, just another key in the existing generic customer preferences
 * store (/customer/preferences) so it reuses infrastructure that's already
 * proven to work rather than adding a new table/endpoint for one string.
 */
const RESTRICTED_CATEGORIES_KEY = 'parental_restricted_categories';

export async function fetchRestrictedCategories(): Promise<string[]> {
    const res = await api.get<{ action: number; data?: Record<string, unknown> }>('/customer/preferences');
    const raw = res?.data?.[RESTRICTED_CATEGORIES_KEY];
    if (typeof raw !== 'string' || !raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
    } catch {
        return [];
    }
}

export async function setRestrictedCategories(categories: string[]): Promise<void> {
    await api.put(`/customer/preferences/${RESTRICTED_CATEGORIES_KEY}`, { value: JSON.stringify(categories) });
}
