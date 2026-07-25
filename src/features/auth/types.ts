import type { ID } from '../../types';

/** Roles in the Connekyt platform. */
export type CustomerType = 'Photographer' | 'Client' | 'Coordinator' | 'Viewer';

export type User = {
    customerId: ID;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    customerType?: CustomerType;
    profilePicture?: string;
    profileCompletionPercentage?: number;
};

export type LoginCredentials = {
    email: string;
    password: string;
};

/** Persisted session: tokens + the user profile. */
export type AuthSession = {
    token: string;
    refreshToken?: string;
    user: User;
};

/**
 * Raw login response from POST /auth/login.
 * action: 1 = success, 0 = OTP unverified / locked, 2 = 2FA required.
 */
export type LoginResponse = {
    action: number;
    message?: string;
    customerId?: ID;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    customerType?: CustomerType;
    profilePicture?: string;
    profileCompletionPercentage?: number;
    token?: string;
    refreshToken?: string;
    token_expiry?: string;
    mustChangePassword?: boolean;
};

/** Response from POST /tv/pairing/initiate. */
export type TvPairingInitiation = {
    pairingCode: string;
    expiresAt: string;
};

/** Response from GET /tv/pairing/status/{code} while PENDING. */
export type TvPairingStatus =
    | { status: 'PENDING' | 'EXPIRED' }
    | ({ status: 'ACTIVE' } & LoginResponse);
