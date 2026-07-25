/**
 * Shared countdown helpers used by the detail hero, the pre-event lobby, and
 * the compact chip on upcoming event cards — so every "starts in" surface
 * counts the same way.
 */

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };

export function splitCountdown(ms: number): CountdownParts {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    return {
        days: Math.floor(totalSec / 86400),
        hours: Math.floor((totalSec % 86400) / 3600),
        minutes: Math.floor((totalSec % 3600) / 60),
        seconds: totalSec % 60,
    };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Parse an event's date (+ optional time) into a target Date, or null. */
export function parseEventStart(eventDate?: string, startTime?: string): Date | null {
    if (!eventDate) return null;
    const d = new Date(`${eventDate}T${startTime ?? '00:00:00'}`);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Compact, no-seconds label for cards: "2d 4h", "22h 57m", "45m". */
export function formatShortCountdown(ms: number): string {
    const { days, hours, minutes } = splitCountdown(ms);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
