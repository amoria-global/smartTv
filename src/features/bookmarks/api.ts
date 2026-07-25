/**
 * Device-local "My List" — there's no account-level bookmarking concept in
 * the backend yet, so saved events live only in this device's localStorage
 * (same honesty tradeoff as playback quality/autoplay prefs). Stores enough
 * of each TvVideo to render a real card on the My List screen without
 * needing to refetch every saved event on load.
 */
import { storage, StorageKeys } from '../../services/storage';
import type { TvVideo } from '../../api/catalog';

async function readAll(): Promise<TvVideo[]> {
    const raw = await storage.get(StorageKeys.bookmarkedEvents);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeAll(videos: TvVideo[]): Promise<void> {
    await storage.set(StorageKeys.bookmarkedEvents, JSON.stringify(videos));
}

export async function getBookmarks(): Promise<TvVideo[]> {
    return readAll();
}

export async function isBookmarked(eventId: string): Promise<boolean> {
    const all = await readAll();
    return all.some((v) => v.id === eventId);
}

/** Adds or removes `video` from the saved list. Returns the new bookmarked state. */
export async function toggleBookmark(video: TvVideo): Promise<boolean> {
    const all = await readAll();
    const exists = all.some((v) => v.id === video.id);
    if (exists) {
        await writeAll(all.filter((v) => v.id !== video.id));
        return false;
    }
    await writeAll([video, ...all]);
    return true;
}
