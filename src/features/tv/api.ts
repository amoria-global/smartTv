/**
 * Paired-TV device management, shown in Settings. Backed by the same
 * amoria-connect endpoints connekt-mobile's "Manage TVs" screen uses
 * (/api/remote/customer/tv-devices).
 */
import { api } from '../../api/client';

export type TvDevice = {
    id: string;
    deviceLabel: string;
    pairedAt: string;
    lastSeenAt?: string;
};

export async function listTvDevices(): Promise<TvDevice[]> {
    const res = await api.get<{ action: number; data?: TvDevice[] }>('/customer/tv-devices');
    return res.data ?? [];
}

export async function removeTvDevice(id: string): Promise<void> {
    await api.delete(`/customer/tv-devices/${encodeURIComponent(id)}`);
}
