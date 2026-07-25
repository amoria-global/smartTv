/**
 * Global auth state (zustand). Holds the session and exposes login/logout
 * plus a bootstrap() that restores a persisted session on app start.
 * Mirrors connekt-mobile/src/store/auth.ts.
 */
import { create } from 'zustand';
import { setOnAuthExpired } from '../api/client';
import * as authApi from '../features/auth/api';
import type { AuthSession, LoginCredentials, User } from '../features/auth/types';
import type { ApiError } from '../types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
    status: AuthStatus;
    session: AuthSession | null;
    user: User | null;
    /** Restore a persisted session (call once at startup). */
    bootstrap: () => Promise<void>;
    login: (credentials: LoginCredentials) => Promise<void>;
    /** Set the session directly (e.g. after QR pairing succeeds). */
    applySession: (session: AuthSession) => void;
    logout: () => Promise<void>;
    /** Signs out every device on the account, not just this TV. */
    logoutAllDevices: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
    status: 'idle',
    session: null,
    user: null,

    bootstrap: async () => {
        set({ status: 'loading' });
        setOnAuthExpired(() => set({ status: 'unauthenticated', session: null, user: null }));

        const session = await authApi.loadSession();
        if (session) {
            set({ status: 'authenticated', session, user: session.user });
        } else {
            set({ status: 'unauthenticated', session: null, user: null });
        }
    },

    login: async (credentials) => {
        const session = await authApi.login(credentials);
        set({ status: 'authenticated', session, user: session.user });
    },

    applySession: (session) => {
        set({ status: 'authenticated', session, user: session.user });
    },

    logout: async () => {
        await authApi.logout();
        set({ status: 'unauthenticated', session: null, user: null });
    },

    logoutAllDevices: async () => {
        await authApi.logoutAllDevices();
        set({ status: 'unauthenticated', session: null, user: null });
    },
}));

/** Narrow helper so screens can show friendly error text. */
export function isApiError(err: unknown): err is ApiError {
    return !!err && typeof err === 'object' && 'message' in err;
}
