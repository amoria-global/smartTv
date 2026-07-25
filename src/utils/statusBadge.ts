import { UiEventStatus } from '../api/catalog';

export type StatusBadge = { label: string; color: string; live?: boolean };

// LIVE/UPCOMING/ENDED colors are hardcoded to match knockout's real event-card
// pills exactly (knockout/app/pages/events/events.tsx status-pill CSS) rather
// than mapped to this app's own theme tokens — the web and TV should read as
// the same product. CANCELLED has no equivalent state on the web card, so it
// still falls back to the app's own error color.
const LIVE_COLOR = '#dc2626';
const UPCOMING_COLOR = '#083A85';
const ENDED_COLOR = '#6b7280';

/** Shared by every screen that renders a FocusableCard's status pill (events grid, Home rows, Related Events). */
export function getStatusBadge(
    status: UiEventStatus | undefined,
    theme: { colorError: string },
    strings: { liveNow: string; startingSoon: string; cancelled: string; ended: string },
): StatusBadge | undefined {
    if (status === 'LIVE') return { label: strings.liveNow, color: LIVE_COLOR, live: true };
    if (status === 'UPCOMING') return { label: strings.startingSoon, color: UPCOMING_COLOR };
    if (status === 'CANCELLED') return { label: strings.cancelled, color: theme.colorError };
    if (status === 'ENDED') return { label: strings.ended, color: ENDED_COLOR };
    return undefined;
}
