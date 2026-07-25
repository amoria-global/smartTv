/**
 * Streaming-quality preference — device-local (bandwidth is a property of
 * this TV's network, not the account), applied to hls.js's real level
 * switching API in player.tsx. If a stream only has one rendition, picking
 * "High" or "Data Saver" is a no-op — hls.js just clamps to what exists.
 */
export type PlaybackQuality = 'auto' | 'high' | 'data-saver';
export const PLAYBACK_QUALITY_OPTIONS: PlaybackQuality[] = ['auto', 'high', 'data-saver'];

export function isPlaybackQuality(v: string | null): v is PlaybackQuality {
    return v === 'auto' || v === 'high' || v === 'data-saver';
}

/** Picks the hls.js level index for a preference, given the levels hls.js reports after MANIFEST_PARSED. */
export function resolveLevelIndex(quality: PlaybackQuality, levels: { bitrate: number }[]): number {
    if (quality === 'auto' || levels.length === 0) return -1; // -1 = hls.js auto ABR
    let bestIdx = 0;
    for (let i = 1; i < levels.length; i++) {
        const better = quality === 'high' ? levels[i].bitrate > levels[bestIdx].bitrate : levels[i].bitrate < levels[bestIdx].bitrate;
        if (better) bestIdx = i;
    }
    return bestIdx;
}
