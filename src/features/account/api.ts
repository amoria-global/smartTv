/**
 * Account summary + preferences for the Settings screen. Backed by the same
 * endpoints connekt-mobile's profile/preferences screens use:
 * GET /customer/profile, GET|PUT /customer/preferences/{key}.
 */
import { api } from '../../api/client';

export type AccountProfile = {
    createdAt?: string;
    lastLogin?: string;
    accountLocked?: boolean;
    kycStatus?: string;
    completionPercentage?: number;
};

export async function fetchAccountProfile(): Promise<AccountProfile> {
    const res = await api.get<{ action: number; data?: Record<string, unknown> }>('/customer/profile');
    const d = res?.data ?? {};
    return {
        createdAt: typeof d.createdAt === 'string' ? d.createdAt : undefined,
        lastLogin: typeof d.lastLogin === 'string' ? d.lastLogin : undefined,
        accountLocked: typeof d.accountLocked === 'boolean' ? d.accountLocked : undefined,
        kycStatus: typeof d.kycStatus === 'string' ? d.kycStatus : undefined,
        completionPercentage: typeof d.completionPercentage === 'number' ? d.completionPercentage : undefined,
    };
}

/**
 * The one notification category that's actually about what you'd watch on
 * this TV — matches connekt-mobile's "Live streams" preference exactly (same
 * key, same backend row). The other 6 keys in the shared preferences store
 * (bookings, payments, albums, gifts, email, push) are account/mobile
 * concepts with nothing to do with a shared living-room screen, so they
 * don't belong in this app's settings even though the keys are real.
 */
export const STREAM_NOTIFICATIONS_KEY = 'stream_fee_notifications';

export async function fetchStreamNotificationsEnabled(): Promise<boolean> {
    const res = await api.get<{ action: number; data?: Record<string, unknown> }>('/customer/preferences');
    const raw = res?.data?.[STREAM_NOTIFICATIONS_KEY];
    return raw === true || raw === 'true';
}

export async function setStreamNotificationsEnabled(enabled: boolean): Promise<void> {
    await api.put(`/customer/preferences/${STREAM_NOTIFICATIONS_KEY}`, { value: String(enabled) });
}
