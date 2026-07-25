/**
 * Auth endpoints against amoria-connect (/api/remote/auth/* and
 * /api/remote/tv/pairing/*). Login returns a flat `action` response; we
 * translate it into an AuthSession. Mirrors connekt-mobile's auth feature,
 * trimmed to what a TV login screen needs (remote email/password + QR
 * pairing) — no signup/OTP/Google here.
 */
import { api } from '../../api/client';
import { storage, StorageKeys } from '../../services/storage';
import type { ApiError } from '../../types';
import type {
    AuthSession,
    CustomerType,
    LoginCredentials,
    LoginResponse,
    TvPairingInitiation,
    TvPairingStatus,
    User,
} from './types';

/**
 * The backend is inconsistent about the coordinator role string
 * ("Coordinator", "event-coordinator", "event_coordinator"). Normalize every
 * variant to the four roles the apps understand, same as connekt-mobile.
 */
function normalizeRole(raw?: string): CustomerType | undefined {
    if (!raw) return undefined;
    const r = raw.toLowerCase().replace(/[\s_]+/g, '-');
    if (r === 'photographer') return 'Photographer';
    if (r === 'client') return 'Client';
    if (r === 'viewer') return 'Viewer';
    if (r === 'coordinator' || r === 'event-coordinator') return 'Coordinator';
    return 'Client';
}

function userFromResponse(res: LoginResponse, fallbackEmail: string): User {
    return {
        customerId: res.customerId ?? '',
        email: res.email ?? fallbackEmail,
        firstName: res.firstName,
        lastName: res.lastName,
        phone: res.phone,
        customerType: normalizeRole(res.customerType as string | undefined),
        profilePicture: res.profilePicture,
        profileCompletionPercentage: res.profileCompletionPercentage,
    };
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
    const res = await api.post<LoginResponse>('/auth/login', credentials, { skipAuth: true });

    if (res.action !== 1 || !res.token) {
        throw {
            status: 401,
            message: res.message || 'Login failed. Check your email and password.',
        } satisfies ApiError;
    }

    const session: AuthSession = {
        token: res.token,
        refreshToken: res.refreshToken,
        user: userFromResponse(res, credentials.email),
    };
    await persistSession(session);
    return session;
}

/** Starts a TV pairing session — call once per QR code shown. */
export async function initiateTvPairing(): Promise<TvPairingInitiation> {
    const res = await api.post<{ action: number; message?: string; data?: TvPairingInitiation }>(
        '/tv/pairing/initiate',
        undefined,
        { skipAuth: true },
    );
    if (res.action !== 1 || !res.data) {
        throw { status: 400, message: res.message || 'Could not start TV pairing.' } satisfies ApiError;
    }
    return res.data;
}

/**
 * Polls the pairing status. Returns null while still pending, an
 * AuthSession once the phone confirms it, or throws if the code expired.
 */
export async function pollTvPairingStatus(pairingCode: string): Promise<AuthSession | null> {
    const res = await api.get<{ action: number; message?: string; data?: TvPairingStatus }>(
        `/tv/pairing/status/${encodeURIComponent(pairingCode)}`,
        { skipAuth: true },
    );
    if (res.action !== 1 || !res.data) {
        throw { status: 400, message: res.message || 'Pairing session not found.' } satisfies ApiError;
    }
    if (res.data.status === 'EXPIRED') {
        throw { status: 410, message: 'This QR code expired. Refresh to get a new one.' } satisfies ApiError;
    }
    if (res.data.status === 'PENDING') return null;

    const loginRes = res.data as LoginResponse & { status: 'ACTIVE' };
    if (!loginRes.token) return null;
    const session: AuthSession = {
        token: loginRes.token,
        refreshToken: loginRes.refreshToken,
        user: userFromResponse(loginRes, ''),
    };
    await persistSession(session);
    return session;
}

/**
 * Logs out this TV only — revokes just this session's refresh token, so a
 * paired phone or the web dashboard stay signed in. Uses /auth/logout-device
 * rather than the older /auth/logout, which revokes every session for the
 * account (that's now reserved for the explicit logoutAllDevices() below).
 */
export async function logout(): Promise<void> {
    try {
        const refreshToken = await storage.get(StorageKeys.refreshToken);
        await api.post('/auth/logout-device', refreshToken ? { refreshToken } : undefined);
    } catch {
        // Even if the server call fails, clear local state.
    }
    await clearSession();
}

/** Signs out every device on the account (TV, phone, web) — a deliberate, distinct action from logout(). */
export async function logoutAllDevices(): Promise<void> {
    try {
        await api.post('/auth/logout');
    } catch {
        // Even if the server call fails, clear local state.
    }
    await clearSession();
}

async function persistSession(session: AuthSession): Promise<void> {
    await storage.set(StorageKeys.authToken, session.token);
    if (session.refreshToken) await storage.set(StorageKeys.refreshToken, session.refreshToken);
    await storage.set(StorageKeys.session, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
    const raw = await storage.get(StorageKeys.session);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthSession;
    } catch {
        return null;
    }
}

export async function clearSession(): Promise<void> {
    await storage.remove(StorageKeys.authToken);
    await storage.remove(StorageKeys.refreshToken);
    await storage.remove(StorageKeys.session);
}
