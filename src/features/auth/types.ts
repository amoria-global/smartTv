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
    /** Seconds the code stays valid, so the screen can run its own countdown. */
    ttlSeconds?: number;
    /**
     * High-entropy proof that THIS device started the pairing (CONN-TV-1).
     *
     * MUST NOT be rendered. The pairing code goes on the screen and is
     * therefore public - anyone in the room, any photo, any shared display can
     * read it - so the code alone cannot be allowed to unlock a session. The
     * backend hands tokens only to a caller presenting this secret, which never
     * leaves the HTTP response.
     */
    deviceSecret?: string;
};

/**
 * Response from GET /tv/pairing/status/{code}.
 *
 * EXPIRED and REVOKED are deliberately distinct (CONN-TV-6): expired means
 * "here is a fresh code", revoked means someone removed this TV from the
 * account, and offering a retry there just re-pairs a device that was
 * deliberately disconnected. ALREADY_CLAIMED means this TV has its session
 * already - it must not be sent back to the QR screen.
 */
export type TvPairingStatus =
    | { status: 'PENDING'; expiresAt?: string }
    | { status: 'EXPIRED' | 'REVOKED' | 'ALREADY_CLAIMED' }
    | ({ status: 'ACTIVE' } & LoginResponse);
