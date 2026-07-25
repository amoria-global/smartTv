/** Splits a real ISO event date into the two-line "MON / DD" badge shown on event cards. */
export function formatDateBadge(eventDate?: string, locale = 'en'): { month: string; day: string } | null {
    if (!eventDate) return null;
    const d = new Date(`${eventDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return {
        month: new Intl.DateTimeFormat(locale, { month: 'short' }).format(d).toUpperCase(),
        day: String(d.getDate()).padStart(2, '0'),
    };
}
