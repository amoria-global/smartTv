/**
 * Maps real Connekyt events into the TvCategory/TvVideo shape the TV screens
 * render. Scoped to what's actually live or about to be — Connekyt's TV
 * experience is "what's streaming right now (or soon)", not a VOD/browse
 * catalog. Reads the same endpoints connekt-mobile uses (customer + public
 * events).
 */
import { api } from './client';
import { fetchRestrictedCategories } from '../features/parental/api';

/**
 * Normalized UI status — the backend's raw `eventStatus` string is messier
 * than a clean enum (PUBLISHED/UPCOMING/PAUSED/ONGOING/COMPLETED/
 * AWAITING_REVIEW/CANCELLED, set from several different code paths), so this
 * collapses it to the 4 states the TV UI actually distinguishes.
 */
export type UiEventStatus = 'LIVE' | 'UPCOMING' | 'ENDED' | 'CANCELLED';

export type TvVideo = {
    id: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    /** Legacy HLS manifest URL — the backend now serves WHEP-only (see `whepUrl`) and always sends this as null, kept only in case a legacy stream ever populates it again. */
    videoUrl?: string;
    /** WebRTC (WHEP) playback URL — sub-second-latency Cloudflare Stream endpoint; this is what's actually populated for live events now. */
    whepUrl?: string;
    description?: string;
    category?: string;
    status?: UiEventStatus;
    /** Real, parseable date/time fields (LocalDate/LocalTime from the backend) — used to compute a live countdown. startTime is frequently null (not every booking sets one). */
    eventDate?: string;
    startTime?: string;
    endTime?: string;
    hostName?: string;
    location?: string;
    /**
     * Free vs package/paid entry — the join/RSVP endpoint requires a paid
     * package selection ("eventPriceId") for anything not explicitly free,
     * so a lightweight "I'm Going" tap only actually works when this is
     * true. Everything else needs the real booking flow (mobile/web).
     */
    isFree?: boolean;
    /** Stream access fee — only present when the DTO actually includes a fee (i.e. > 0); absent/undefined means free. */
    streamFee?: number;
    streamFeeCurrencySymbol?: string;
    /** hostName above is photographerName ?? eventOrganizer for compact contexts (cards); these two are kept separate for the full detail page, since they're genuinely distinct people/roles. */
    organizerName?: string;
    photographerName?: string;
    photographerImage?: string;
    /** Real but frequently unset — only shown when the booking actually specified a cap. */
    maxGuests?: number;
    tags?: string[];
    /** Whether this event has an active, real invite-code (free invite-only streams, not paid access). */
    hasInviteCode?: boolean;
    /** SEO slug of this event's live stream — lets us link to the public gift/watch page at connekyt.com/user/events/livestream/{slug} (e.g. for the player's gift QR code). Absent if the event has no associated stream row yet. */
    streamSlug?: string;
    /** 'entry_fee' streams need the pay-to-watch QR gate; 'invite_token' ones use the free InviteGate above instead. */
    streamType?: 'entry_fee' | 'invite_token' | null;
    /** Set when this account (or, for anonymous/device-based access, a prior visit) already paid — skips the pay gate even though whepUrl itself may still be null until the stream goes live. */
    hasPurchasedAccess?: boolean;
};

export type TvCategory = {
    id: string;
    title: string;
    videos: TvVideo[];
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function unwrapList(data: unknown): Raw[] {
    if (Array.isArray(data)) return data as Raw[];
    const content = (data as { content?: unknown })?.content;
    return Array.isArray(content) ? (content as Raw[]) : [];
}

/**
 * "Is this event live?" — deliberately the SAME rule the backend's own LIVE
 * tab uses (statusParam maps LIVE -> status=ONGOING), i.e. purely
 * eventStatus === ONGOING. Nothing else.
 *
 * It used to also return true on a bare `hasLiveStream` flag or a
 * `streamStatus` of live/started/streaming. But `hasLiveStream` isn't
 * reliably cleared by the backend when a stream ends, so those extra checks
 * marked already-finished events as live — which is why the "Live now" count
 * (backend-filtered, ONGOING only) could read 0 while a card still showed a
 * LIVE badge. Trusting eventStatus alone keeps the count and the cards in
 * agreement. (Root cause is the stale backend flag; this is the client-side
 * reconciliation.)
 */
function isLiveEvent(r: Raw): boolean {
    return String(r.eventStatus ?? '').toUpperCase() === 'ONGOING';
}

/**
 * A booked-but-not-yet-streaming event sits at raw eventStatus "PUBLISHED"
 * (set once at booking time) until someone starts a stream session, which is
 * when it briefly becomes "UPCOMING"/"PAUSED" — both mean the same thing to
 * a viewer: not live yet.
 */
function isUpcomingEvent(r: Raw): boolean {
    if (isLiveEvent(r)) return false;
    const s = String(r.eventStatus ?? '').toUpperCase();
    return s === 'PUBLISHED' || s === 'UPCOMING' || s === 'PAUSED';
}

function computeUiStatus(r: Raw): UiEventStatus | undefined {
    if (isLiveEvent(r)) return 'LIVE';
    const s = String(r.eventStatus ?? '').toUpperCase();
    if (s === 'CANCELLED') return 'CANCELLED';
    if (s === 'COMPLETED' || s === 'AWAITING_REVIEW') return 'ENDED';
    if (isUpcomingEvent(r)) return 'UPCOMING';
    return undefined;
}

function mapEventToVideo(r: Raw): TvVideo {
    const cat = (r.eventCategory ?? {}) as Raw;
    const subtitleParts = [str(r.eventDate), str(r.location)].filter(Boolean);
    return {
        id: String(r.id ?? ''),
        title: str(r.title) ?? 'Untitled event',
        subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
        imageUrl: str(r.eventPhoto) ?? str(r.coverImage) ?? str(r.thumbnail),
        videoUrl: str(r.hlsManifestUrl),
        whepUrl: str(r.whepUrl),
        description: str(r.description),
        category: str(cat.name) ?? str(r.category) ?? str(r.eventType),
        status: computeUiStatus(r),
        eventDate: str(r.eventDate),
        startTime: str(r.startTime),
        endTime: str(r.endTime),
        hostName: str(r.photographerName) ?? str(r.eventOrganizer),
        location: str(r.location),
        isFree: String(r.isEventFree ?? '').toUpperCase() === 'YES',
        streamFee: typeof r.streamFee === 'number' ? r.streamFee : undefined,
        streamFeeCurrencySymbol: str(r.streamFeeCurrencySymbol),
        organizerName: str(r.eventOrganizer),
        photographerName: str(r.photographerName),
        photographerImage: str(r.photographerImage),
        maxGuests: typeof r.maxGuests === 'number' ? r.maxGuests : undefined,
        tags: str(r.eventTags)
            ?.split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        hasInviteCode: r.hasInviteCode === true,
        streamSlug: str(r.streamSlug),
        streamType: r.streamType === 'entry_fee' || r.streamType === 'invite_token' ? r.streamType : null,
        hasPurchasedAccess: r.hasPurchasedAccess === true,
    };
}

async function safeList(path: string, opts?: { skipAuth?: boolean }): Promise<Raw[]> {
    try {
        const res = await api.get<{ action: number; data?: unknown }>(path, opts);
        return unwrapList(res?.data);
    } catch {
        return [];
    }
}

async function fetchCategoriesUnfiltered(): Promise<TvCategory[]> {
    // Public catalog only - matches exactly what's actually live/upcoming on
    // the backend. This used to also merge in /customer/events (whichever
    // account is signed into this TV), which pulled in that account's own
    // bookings regardless of publish status, making the home screen show a
    // different picture than the real public event list.
    const publicRaw = await safeList('/public/events/list?size=30', { skipAuth: true });

    const seen = new Set<string>();
    const live: TvVideo[] = [];
    const upcoming: TvVideo[] = [];
    for (const r of publicRaw) {
        const id = String(r.id ?? '');
        if (!id || seen.has(id)) continue;
        if (isLiveEvent(r)) {
            seen.add(id);
            live.push(mapEventToVideo(r));
        } else if (isUpcomingEvent(r)) {
            seen.add(id);
            upcoming.push(mapEventToVideo(r));
        }
    }

    const categories: TvCategory[] = [];
    if (live.length) categories.push({ id: 'live-now', title: 'Live Now', videos: live });
    if (upcoming.length) categories.push({ id: 'coming-up', title: 'Coming Up', videos: upcoming });
    return categories;
}

/** Category names in Title Case for matching regardless of source casing. */
function normalizeCategory(c: string): string {
    return c.trim().toLowerCase();
}

/**
 * Same as fetchCategoriesUnfiltered, minus any event whose category is on
 * the account's parental-controls restricted list — this is the one every
 * browsing screen (Home, Search, AI Recommendations) should call.
 */
export async function fetchCategories(): Promise<TvCategory[]> {
    const [categories, restricted] = await Promise.all([fetchCategoriesUnfiltered(), fetchRestrictedCategories().catch(() => [])]);
    if (!restricted.length) return categories;
    const restrictedSet = new Set(restricted.map(normalizeCategory));
    return categories
        .map((c) => ({ ...c, videos: c.videos.filter((v) => !v.category || !restrictedSet.has(normalizeCategory(v.category))) }))
        .filter((c) => c.videos.length > 0);
}

/** Every distinct event category currently live or upcoming — used to populate the Parental Controls lock list (unfiltered, or a locked category could never be found again to unlock). */
export async function fetchAllCategoryNames(): Promise<string[]> {
    const categories = await fetchCategoriesUnfiltered();
    const names = new Set<string>();
    categories.forEach((c) => c.videos.forEach((v) => v.category && names.add(v.category)));
    return Array.from(names).sort();
}

export async function isCategoryRestricted(category?: string): Promise<boolean> {
    if (!category) return false;
    const restricted = await fetchRestrictedCategories().catch(() => []);
    return restricted.map(normalizeCategory).includes(normalizeCategory(category));
}

/**
 * A real, unauthenticated featured photo for full-bleed background use
 * (e.g. the login screen, before anyone is signed in) — picks the first
 * public event with a cover image rather than a stock/placeholder asset.
 */
export async function fetchLoginBackdrop(): Promise<string | null> {
    const raw = await safeList('/public/events/list?size=10', { skipAuth: true });
    for (const r of raw) {
        const image = str(r.eventPhoto) ?? str(r.coverImage) ?? str(r.thumbnail);
        if (image) return image;
    }
    return null;
}

export async function fetchVideos(): Promise<TvVideo[]> {
    const categories = await fetchCategories();
    return categories.flatMap((c) => c.videos);
}

export async function fetchVideoDetails(id: string): Promise<TvVideo> {
    const customerRes = await api
        .get<{ action: number; data?: Raw }>(`/customer/events/${encodeURIComponent(id)}`)
        .catch(() => null);
    if (customerRes?.data?.id) return mapEventToVideo(customerRes.data);

    const publicRes = await api.get<{ action: number; data?: Raw }>(
        `/public/events/${encodeURIComponent(id)}`,
        { skipAuth: true },
    );
    return mapEventToVideo((publicRes?.data ?? {}) as Raw);
}

/** Real-time-ish (60s heartbeat window server-side) count of active viewers — only meaningful while an event is ONGOING. */
export async function fetchViewerCount(eventId: string): Promise<number | null> {
    try {
        const res = await api.get<{ action: number; data?: { viewerCount?: number } }>(
            `/public/events/${encodeURIComponent(eventId)}/viewers`,
            { skipAuth: true },
        );
        return typeof res?.data?.viewerCount === 'number' ? res.data.viewerCount : null;
    } catch {
        return null;
    }
}

/** Other live events sharing this one's category — for the "Related Events" row. */
export async function fetchRelatedVideos(currentId: string, category?: string): Promise<TvVideo[]> {
    if (!category) return [];
    const videos = await fetchVideos();
    return videos.filter((v) => v.id !== currentId && v.category?.toLowerCase() === category.toLowerCase());
}

export type EventsPage = {
    videos: TvVideo[];
    page: number;
    totalPages: number;
    totalElements: number;
};

/**
 * Maps to the real `status` query param on /public/events/list — the
 * backend already implements this exact tab model (see EventSpec.
 * publicTabVisibility): ALL excludes unfeatured ended events automatically,
 * ENDED only returns events an admin opted into "recently ended", UPCOMING
 * additionally requires eventDate >= today server-side.
 */
export type EventTabFilter = 'ALL' | 'LIVE' | 'UPCOMING' | 'ENDED';

function statusParam(filter: EventTabFilter): string | null {
    if (filter === 'LIVE') return 'ONGOING';
    if (filter === 'UPCOMING') return 'UPCOMING';
    if (filter === 'ENDED') return 'COMPLETED';
    return null;
}

/**
 * The full public event catalog (live, upcoming, and ended — not just
 * "what's live now"), paged by the backend's real Spring Data pagination
 * rather than fetching everything and slicing client-side. Used by the
 * "Browse All Events" grid and, with `search` set, the Search screen —
 * the backend's `search` param matches title/description/location/tags
 * server-side (EventSpec.searchEvents), across every event, not just the
 * small live+upcoming slice `fetchVideos` keeps for the home rows.
 */
export async function fetchEventsPage(page: number, size = 8, filter: EventTabFilter = 'ALL', search = ''): Promise<EventsPage> {
    const status = statusParam(filter);
    const qs = `size=${size}&page=${page}${status ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const res = await api.get<{ action: number; data?: Raw }>(`/public/events/list?${qs}`, { skipAuth: true });
    const data = (res?.data ?? {}) as Raw;
    const content = unwrapList(data);

    const restricted = await fetchRestrictedCategories().catch(() => []);
    const restrictedSet = new Set(restricted.map(normalizeCategory));
    const videos = content
        .map(mapEventToVideo)
        .filter((v) => !v.category || !restrictedSet.has(normalizeCategory(v.category)));

    return {
        videos,
        page: typeof data.number === 'number' ? data.number : page,
        totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
        totalElements: typeof data.totalElements === 'number' ? data.totalElements : content.length,
    };
}
