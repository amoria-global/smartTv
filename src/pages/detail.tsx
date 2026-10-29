import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { midnightGlass } from '../components/glass/glassStyle';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext } from '../config';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { Row } from '../components/Row';
import { FocusableButton } from '../components/FocusableButton';
import { CountdownFlipCard } from '../components/CountdownFlipCard';
import { QrHandoffCard } from '../components/QrHandoffCard';
import { useFocusNav } from '../hooks/useFocusNav';
import { useBackHandler } from '../hooks/useBackHandler';
import {
    fetchRelatedVideos,
    fetchVideoDetails,
    fetchViewerCount,
    isCategoryRestricted,
    TvVideo,
} from '../api/catalog';
import {
    joinEvent,
    reconcileAnonymousStreamAccess,
    resolveViewerIdByFingerprint,
    checkAnonymousStreamAccess,
} from '../features/events/api';
import { getTvDeviceId } from '../services/deviceId';
import { paidPurchasesEnabled } from '../config/policy';
import { isBookmarked, toggleBookmark } from '../features/bookmarks/api';
import { useAuth } from '../store/auth';
import { useTranslation } from '../i18n';

const WEB_BASE = 'https://connekyt.com';
// Device-based pay-to-watch page (same one the live player's pay gate uses).
// The TV's own device id is baked into the QR so the phone-side payment binds
// to THIS TV — works for a guest (no login), can't be mixed up between
// devices, and unlocks the *stream-access* flag the TV actually checks.
const PAY_TO_WATCH_BASE_URL = 'https://connekyt.com/pay-to-watch';

function parseEventStart(eventDate?: string, startTime?: string): Date | null {
    if (!eventDate) return null;
    const d = new Date(`${eventDate}T${startTime ?? '00:00:00'}`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatLongDate(date: Date | null, raw?: string): string | undefined {
    if (!date) return raw;
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function formatTimeRange(startTime?: string, endTime?: string): string | null {
    if (!startTime) return null;
    const fmt = (t: string) => {
        const [h, m] = t.split(':');
        const d = new Date();
        d.setHours(Number(h), Number(m ?? 0));
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
    };
    return endTime ? `${fmt(startTime)} - ${fmt(endTime)}` : fmt(startTime);
}

export default function DetailScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const { id } = router.query;
    const user = useAuth((s) => s.user);

    const [video, setVideo] = useState<TvVideo | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [restricted, setRestricted] = useState(false);
    const [related, setRelated] = useState<TvVideo[]>([]);
    const [viewerCount, setViewerCount] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [joinState, setJoinState] = useState<'idle' | 'joining' | 'joined' | 'failed'>('idle');
    const [reserveOpen, setReserveOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'notfound'>('idle');
    const [paidSuccess, setPaidSuccess] = useState(false);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [deviceAccess, setDeviceAccess] = useState(false);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // This TV's stable device id — baked into the pay-to-watch QR so a payment
    // binds to THIS device (guest-friendly, no mix-ups). Loaded once on mount.
    useEffect(() => {
        getTvDeviceId().then(setDeviceId).catch(() => {});
    }, []);

    // Back key closes whichever overlay is open instead of leaving the page.
    useBackHandler(
        () => {
            if (reserveOpen) setReserveOpen(false);
            else if (shareOpen) setShareOpen(false);
        },
        reserveOpen || shareOpen,
    );

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setNotFound(false);
        fetchVideoDetails(id as string)
            .then(async (data) => {
                if (!data.id) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }
                setVideo(data);
                setRestricted(await isCategoryRestricted(data.category));
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load content', err);
                setNotFound(true);
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!video) return;
        fetchRelatedVideos(video.id, video.category).then(setRelated);
    }, [video?.id, video?.category]);

    // Live viewer count only means something while the stream is actually
    // ongoing — polled lightly rather than claiming true push-based realtime.
    useEffect(() => {
        if (!video || video.status !== 'LIVE') return;
        let active = true;
        const poll = () => fetchViewerCount(video.id).then((c) => active && setViewerCount(c));
        poll();
        const interval = setInterval(poll, 20000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [video?.id, video?.status]);

    // On load, for a paid event the account hasn't already purchased, check
    // whether THIS DEVICE already paid (guest pay-to-watch). Without this, a
    // device that already paid would come back to "Reserve your spot" because
    // the page only ever looked at the account flag.
    useEffect(() => {
        if (!video) return;
        setDeviceAccess(false);
        if (video.hasPurchasedAccess) return;
        const paidStream = video.streamType === 'entry_fee' || (video.streamFee ?? 0) > 0;
        if (!paidStream) return;
        let active = true;
        (async () => {
            const dev = deviceId ?? (await getTvDeviceId().catch(() => null));
            if (!dev || !active) return;
            const rec = await reconcileAnonymousStreamAccess(video.id, dev).catch(() => ({ hasAccess: false }));
            if (active && rec.hasAccess) setDeviceAccess(true);
        })();
        return () => {
            active = false;
        };
    }, [video?.id, video?.hasPurchasedAccess, video?.streamType, video?.streamFee, deviceId]);

    // Countdown ticks once a second for upcoming events so the flip-card
    // seconds box actually counts down (matches the web event page).
    useEffect(() => {
        if (!video || video.status !== 'UPCOMING') return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [video?.status]);

    // Load device-local bookmark state for the save button.
    useEffect(() => {
        if (!video) return;
        isBookmarked(video.id).then(setBookmarked).catch(() => {});
    }, [video?.id]);

    const handleToggleBookmark = async () => {
        if (!video) return;
        const next = await toggleBookmark(video);
        setBookmarked(next);
    };

    // Payment confirmed → show a brief success overlay, then send the viewer
    // straight to the streaming page (watermark + countdown / live playback).
    const goToStreamAfterPayment = () => {
        if (!video) return;
        setReserveOpen(false);
        setVerifyState('idle');
        setPaidSuccess(true);
        if (redirectTimer.current) clearTimeout(redirectTimer.current);
        redirectTimer.current = setTimeout(() => router.push(`/player?id=${video.id}`), 1900);
    };

    useEffect(() => () => {
        if (redirectTimer.current) clearTimeout(redirectTimer.current);
    }, []);

    // "Already paid? Verify access": re-pull the event; a completed phone-side
    // payment flips hasPurchasedAccess, which confirms access and takes the
    // viewer to the stream. No new payment happens here.
    const handleVerifyAccess = async () => {
        if (!video) return;
        setVerifyState('checking');
        try {
            // 1) Account path — did the signed-in account pay (via web/mobile)?
            const fresh = await fetchVideoDetails(video.id);
            const accountPaid = fresh.hasPurchasedAccess === true;
            if (fresh.id) setVideo(fresh);

            // 2) Device path — did a (possibly guest) payment bind to THIS TV
            //    via the pay-to-watch QR? Reconcile re-pulls the transaction.
            let devicePaid = false;
            const dev = deviceId ?? (await getTvDeviceId().catch(() => null));
            if (dev) {
                const rec = await reconcileAnonymousStreamAccess(video.id, dev);
                devicePaid = rec.hasAccess;
            }

            if (accountPaid || devicePaid) {
                goToStreamAfterPayment();
                return;
            }
            setVerifyState('notfound');
        } catch (e) {
            setVerifyState('notfound');
        }
    };

    // Simplest possible experience: while a paid event is open and not yet
    // unlocked, the TV keeps checking on its own every 5s — BOTH the account
    // (paid on web/mobile signed in) and this device (paid via the TV's QR as
    // a guest). The instant either shows access, it takes the viewer straight
    // to the stream. No login, no typing, no button to press — they scan the
    // TV's code, pay on their phone, and the TV unlocks itself.
    //
    // Uses the light "read status" checks for the loop (a couple of GETs);
    // the heavier force-recheck (reconcile) is reserved for the manual
    // "Already paid? Verify access" backup button.
    useEffect(() => {
        if (!video || video.hasPurchasedAccess || deviceAccess || paidSuccess) return;
        const isPaid = video.streamType === 'entry_fee' || (video.streamFee ?? 0) > 0;
        const canGoLive = video.status === 'UPCOMING' || video.status === 'LIVE';
        if (!isPaid || !canGoLive) return;
        let active = true;
        const tick = async () => {
            try {
                const fresh = await fetchVideoDetails(video.id);
                if (active && fresh.id && fresh.hasPurchasedAccess) {
                    setVideo(fresh);
                    goToStreamAfterPayment();
                    return;
                }
                const dev = deviceId ?? (await getTvDeviceId().catch(() => null));
                if (!active || !dev) return;
                const viewerId = await resolveViewerIdByFingerprint(video.id, dev);
                if (!active || !viewerId) return;
                const res = await checkAnonymousStreamAccess(video.id, viewerId, dev);
                if (active && res.hasAccess) goToStreamAfterPayment();
            } catch {
                /* transient — keep polling */
            }
        };
        const t = setInterval(tick, 5000);
        return () => {
            active = false;
            clearInterval(t);
        };
    }, [video?.id, video?.hasPurchasedAccess, video?.streamType, video?.streamFee, video?.status, deviceAccess, paidSuccess, deviceId]);

    if (loading) {
        return (
            <ScreenWrapper noPadding>
                <Navbar />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#F20C8F" />
                </View>
            </ScreenWrapper>
        );
    }

    if (notFound || !video) {
        return (
            <ScreenWrapper noPadding>
                <Navbar />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 }}>
                    <i className="bi bi-emoji-frown" style={{ fontSize: 40, color: theme.static.colorAccent, marginBottom: 16 }} />
                    <Text style={[styles.heroTitle, { color: theme.static.colorTextPrimary, fontSize: 28, textAlign: 'center' }]}>
                        {strings.detail.eventNotFoundTitle}
                    </Text>
                    <Text style={[styles.heroSubtitle, { color: theme.static.colorTextSecondary, textAlign: 'center', maxWidth: 480, marginBottom: 32 }]}>
                        {strings.detail.eventNotFoundBody}
                    </Text>
                    <FocusableButton title={strings.detail.back} onPress={() => router.back()} hasTVPreferredFocus />
                </View>
            </ScreenWrapper>
        );
    }

    if (restricted) {
        return (
            <ScreenWrapper noPadding>
                <Navbar />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 }}>
                    <i className="bi bi-shield-lock" style={{ fontSize: 40, color: theme.static.colorAccent, marginBottom: 16 }} />
                    <Text style={[styles.heroTitle, { color: theme.static.colorTextPrimary, fontSize: 28, textAlign: 'center' }]}>
                        {strings.detail.restrictedTitle}
                    </Text>
                    <Text style={[styles.heroSubtitle, { color: theme.static.colorTextSecondary, textAlign: 'center', maxWidth: 480, marginBottom: 32 }]}>
                        {strings.detail.restrictedBody}
                    </Text>
                    <FocusableButton title={strings.detail.back} onPress={() => router.back()} hasTVPreferredFocus />
                </View>
            </ScreenWrapper>
        );
    }

    const isLive = video.status === 'LIVE';
    const isUpcoming = video.status === 'UPCOMING';
    const isEnded = video.status === 'ENDED';
    const isCancelled = video.status === 'CANCELLED';
    // Live is enough to route to the player page even before whepUrl exists:
    // entry_fee/invite_token streams deliberately withhold whepUrl until the
    // viewer unlocks access, and it's the player page itself (not this one)
    // that shows the pay/invite gate and resolves it once unlocked.
    const isPlayable = isLive && !!(video.whepUrl || video.videoUrl || video.streamType === 'entry_fee' || video.hasInviteCode);

    const startDate = parseEventStart(video.eventDate, video.startTime);
    const countdownMs = startDate ? startDate.getTime() - now : 0;
    // Show the countdown for any upcoming event that has a start time — the
    // flip-card counts down when it's in the future, and shows "Any moment now"
    // once the scheduled time has passed but the event still hasn't gone live.
    const showCountdown = isUpcoming && !!video.startTime;
    const timeRange = formatTimeRange(video.startTime, video.endTime);
    const longDate = formatLongDate(startDate, video.eventDate);

    const statusLabel = isLive
        ? strings.detail.liveNow
        : isUpcoming
          ? strings.detail.startingSoon
          : isCancelled
            ? strings.detail.cancelled
            : isEnded
              ? strings.detail.ended
              : null;
    const statusColor = isLive ? theme.static.colorLive : isUpcoming ? theme.static.colorAccent : isCancelled ? theme.static.colorError : theme.static.colorTextSecondary;

    const handleJoin = async () => {
        setJoinState('joining');
        const res = await joinEvent(video.id);
        setJoinState(res.ok ? 'joined' : 'failed');
    };

    // Whether this event is already paid for — either on the signed-in ACCOUNT
    // (hasPurchasedAccess) or on THIS DEVICE (deviceAccess, from a guest
    // pay-to-watch). A paid viewer who returns should see the reserved/paid
    // state ("Watch Live"), not "Reserve your spot" again.
    const hasPaidAccess = video.hasPurchasedAccess === true || deviceAccess;

    const isFreeEntry = !video.streamFee || video.streamFee <= 0;
    const priceLabel = `${video.streamFeeCurrencySymbol ?? ''}${video.streamFee ?? ''}`.trim();

    // The one-tap join endpoint requires a paid package selection for anything
    // not explicitly free, so it only actually succeeds for free events. Paid
    // upcoming events instead get a "Reserve your spot" button that hands off
    // to the phone via QR (setReserveOpen), since real package booking +
    // payment can't happen on a remote-driven TV screen.
    //
    // Order matters: once paid (hasPaidAccess), an upcoming paid event skips
    // "Reserve" entirely and shows "Watch Live" → the lobby.
    type Action = { title: string; icon: string; onPress: () => void; disabled?: boolean; price?: string };
    const primaryAction: Action | null = isPlayable
        ? { title: strings.detail.watchNow, icon: 'bi-play-fill', onPress: () => router.push(`/player?id=${video.id}`) }
        : isUpcoming && video.isFree
          ? {
                title: joinState === 'joined' ? strings.detail.going : joinState === 'joining' ? strings.detail.joining : strings.detail.imGoing,
                icon: joinState === 'joined' ? 'bi-check-circle-fill' : 'bi-check2',
                onPress: handleJoin,
                disabled: joinState === 'joining' || joinState === 'joined',
            }
          : isUpcoming && hasPaidAccess
            ? { title: strings.detail.watchLive, icon: 'bi-play-fill', onPress: () => router.push(`/player?id=${video.id}`) }
            : // Reserve is an in-app purchase QR for PAID events. In reader mode
              // (paidPurchasesEnabled=false, the store-safe fallback) suppress it
              // for paid events — free-entry RSVP isn't a purchase, so it stays.
              isUpcoming && (paidPurchasesEnabled || isFreeEntry)
              ? { title: strings.detail.reserveYourSpot, icon: 'bi-ticket-perforated-fill', price: isFreeEntry ? undefined : priceLabel, onPress: () => setReserveOpen(true) }
              : null;

    // Secondary action mirrors the web's "Already paid? Verify access" for a
    // paid-but-unpaid event, and "Wait in the lobby" for a free one.
    const secondaryAction: Action | null = isUpcoming && !video.isFree && !hasPaidAccess
        ? {
              title: verifyState === 'checking' ? strings.detail.verifyChecking : strings.detail.verifyAccess,
              icon: 'bi-shield-check',
              onPress: handleVerifyAccess,
              disabled: verifyState === 'checking',
          }
        : isUpcoming && video.isFree
          ? { title: strings.detail.enterLobby, icon: 'bi-hourglass-split', onPress: () => router.push(`/player?id=${video.id}`) }
          : null;

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <ScrollView style={styles.scroll}>
                {/* --- Hero (matches the web event page layout) --- */}
                <View style={styles.hero}>
                    {/* Cover fill — the poster spans the whole hero edge-to-edge. */}
                    <Image source={{ uri: video.imageUrl }} style={styles.backdrop} resizeMode="cover" />
                    <View style={[styles.heroScrim, { backgroundColor: theme.static.colorBgPrimary }]} />
                    <View style={styles.heroBottomFade} />

                    {/* Top-left back */}
                    <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
                        <i className="bi bi-chevron-left" style={{ fontSize: 18, color: '#fff' }} />
                    </TouchableOpacity>

                    {/* Top-right: share + save */}
                    <View style={styles.topRightActions}>
                        <TopCircleButton icon="bi-share" onPress={() => setShareOpen(true)} />
                        <TopCircleButton
                            icon={bookmarked ? 'bi-bookmark-fill' : 'bi-bookmark'}
                            tint={bookmarked ? theme.static.colorAccent : '#fff'}
                            onPress={handleToggleBookmark}
                        />
                    </View>

                    {/* Top-center countdown flip-card */}
                    {showCountdown ? (
                        <View style={styles.countdownAnchor}>
                            <CountdownFlipCard msRemaining={countdownMs} />
                        </View>
                    ) : null}

                    {/* Bottom-left content */}
                    <View style={styles.heroContent}>
                        <View style={styles.pillRow}>
                            {statusLabel ? (
                                <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
                                    {isLive ? <View style={styles.liveDot} /> : <i className="bi bi-broadcast" style={{ fontSize: 13, color: '#fff' }} />}
                                    <Text style={styles.statusPillText}>{statusLabel}</Text>
                                </View>
                            ) : null}
                            {video.category ? (
                                <View style={styles.categoryPill}>
                                    <Text style={styles.categoryPillText}>{video.category.toUpperCase()}</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text style={[styles.heroTitle, { color: theme.static.colorTextPrimary }]}>{video.title}</Text>

                        {video.subtitle ? (
                            <Text style={[styles.heroSubtitle, { color: theme.static.colorTextSecondary }]}>{video.subtitle}</Text>
                        ) : null}

                        {/* Inline meta row: date · time · venue · capacity */}
                        <View style={styles.metaRow}>
                            {longDate ? <MetaItem icon="bi-calendar3" text={longDate} /> : null}
                            {timeRange ? <MetaItem icon="bi-clock" text={timeRange} /> : null}
                            {video.location ? <MetaItem icon="bi-geo-alt" text={video.location} /> : null}
                            {video.maxGuests ? <MetaItem icon="bi-people" text={`${video.maxGuests.toLocaleString()} ${strings.detail.peopleSuffix}`} /> : null}
                            {isLive && viewerCount !== null ? <MetaItem icon="bi-eye" text={String(viewerCount)} tone={theme.static.colorAccentLight} /> : null}
                        </View>

                        {/* Action bar */}
                        <View style={styles.actionBar}>
                            {primaryAction ? (
                                <ActionButton
                                    title={primaryAction.title}
                                    icon={primaryAction.icon}
                                    price={primaryAction.price}
                                    onPress={primaryAction.onPress}
                                    disabled={primaryAction.disabled}
                                    hasTVPreferredFocus
                                    variant="primary"
                                />
                            ) : isLive ? (
                                <Text style={[styles.rsvpError, { color: theme.static.colorTextSecondary }]}>
                                    {strings.detail.streamNotReadyNote}
                                </Text>
                            ) : null}

                            {secondaryAction ? (
                                <ActionButton
                                    title={secondaryAction.title}
                                    icon={secondaryAction.icon}
                                    onPress={secondaryAction.onPress}
                                    disabled={secondaryAction.disabled}
                                    variant="secondary"
                                />
                            ) : null}
                        </View>

                        {isUpcoming && hasPaidAccess ? (
                            <View style={styles.reservedNoteRow}>
                                <i className="bi bi-check-circle-fill" style={{ fontSize: 15, color: theme.static.colorSuccess }} />
                                <Text style={[styles.reservedNoteText, { color: theme.static.colorTextSecondary }]}>
                                    {strings.detail.reservedNote}
                                </Text>
                            </View>
                        ) : null}

                        {/* Reader mode: paid event with no in-app purchase — explain
                            that access is granted elsewhere and unlocks here. */}
                        {isUpcoming && !hasPaidAccess && !isFreeEntry && !video.isFree && !paidPurchasesEnabled ? (
                            <View style={styles.reservedNoteRow}>
                                <i className="bi bi-lock-fill" style={{ fontSize: 14, color: theme.static.colorTextSecondary }} />
                                <Text style={[styles.reservedNoteText, { color: theme.static.colorTextSecondary }]}>
                                    {strings.detail.paidReaderNote}
                                </Text>
                            </View>
                        ) : null}

                        {verifyState === 'notfound' && !hasPaidAccess ? (
                            <View style={{ marginTop: 10, maxWidth: 620 }}>
                                <Text style={[styles.rsvpError, { color: theme.static.colorTextSecondary, marginTop: 0 }]}>
                                    {strings.detail.verifyNotFound}
                                </Text>
                                {/* The TV can only see a payment made under the account it's
                                    signed into — surfacing which account makes a guest/wrong
                                    -account payment obvious instead of a silent dead end. */}
                                <Text style={[styles.verifyHint, { color: theme.static.colorTextSecondary }]}>
                                    {strings.detail.verifySignedInAs} <Text style={{ fontWeight: '700' }}>{user?.email ?? '—'}</Text>. {strings.detail.verifyPayHint}
                                </Text>
                            </View>
                        ) : null}

                        {joinState === 'failed' ? (
                            <Text style={[styles.rsvpError, { color: theme.static.colorError, marginTop: 10 }]}>{strings.detail.rsvpFailed}</Text>
                        ) : null}
                    </View>
                </View>

                {/* --- Two-column info section --- */}
                <View style={styles.columns}>
                    <View style={styles.leftColumn}>
                        <SectionHeader label={strings.detail.aboutHeader} />
                        <View style={[styles.card, styles.glass]}>
                            <Text style={[styles.description, { color: theme.static.colorTextPrimary }]}>
                                {video.description || strings.detail.noDescription}
                            </Text>
                            {video.tags?.length ? (
                                <View style={styles.tagRow}>
                                    {video.tags.map((tag) => (
                                        <View key={tag} style={styles.tagPill}>
                                            <Text style={[styles.tagText, { color: theme.static.colorTextSecondary }]}>#{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                            {isEnded ? (
                                <Text style={[styles.replayNote, { color: theme.static.colorTextSecondary }]}>{strings.detail.replayNote}</Text>
                            ) : null}
                        </View>

                        {(video.organizerName || video.photographerName) ? (
                            <>
                                <SectionHeader label={strings.detail.hostLabel} />
                                <View style={styles.hostRow}>
                                    {video.organizerName ? (
                                        <HostCard
                                            role={strings.detail.eventOrganizerRole}
                                            name={video.organizerName}
                                            icon="bi-mic-fill"
                                            color={theme.static.colorBrand}
                                        />
                                    ) : null}
                                    {video.photographerName ? (
                                        <HostCard
                                            role={strings.detail.photographerLabel}
                                            name={video.photographerName}
                                            image={video.photographerImage}
                                            icon="bi-camera-fill"
                                            color={theme.static.colorAccent}
                                        />
                                    ) : null}
                                </View>
                            </>
                        ) : null}
                    </View>

                    <View style={styles.rightColumn}>
                        <View style={[styles.card, styles.glass]}>
                            <View
                                style={[
                                    styles.priceBox,
                                    (isFreeEntry || hasPaidAccess)
                                        ? { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: theme.static.colorSuccess }
                                        : { backgroundColor: 'rgba(242, 12, 143, 0.12)', borderColor: theme.static.colorAccent },
                                ]}
                            >
                                {hasPaidAccess && !isFreeEntry ? (
                                    <>
                                        <View style={styles.priceBoxTitleRow}>
                                            <i className="bi bi-check-circle-fill" style={{ fontSize: 16, color: theme.static.colorSuccess }} />
                                            <Text style={[styles.priceBoxTitle, { color: theme.static.colorSuccess }]}>{strings.detail.reservedPaid}</Text>
                                        </View>
                                        <Text style={[styles.priceBoxSubtitle, { color: theme.static.colorTextSecondary }]}>
                                            {strings.common.fromPricePrefix} {video.streamFeeCurrencySymbol ?? ''}{video.streamFee}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={[styles.priceBoxTitle, { color: isFreeEntry ? theme.static.colorSuccess : theme.static.colorAccent }]}>
                                            {isFreeEntry ? strings.detail.freeEntry : `${strings.common.fromPricePrefix} ${video.streamFeeCurrencySymbol ?? ''}${video.streamFee}`}
                                        </Text>
                                        {isFreeEntry ? (
                                            <Text style={[styles.priceBoxSubtitle, { color: theme.static.colorTextSecondary }]}>
                                                {strings.detail.noPurchaseRequired}
                                            </Text>
                                        ) : null}
                                    </>
                                )}
                            </View>

                            <SidebarInfoRow icon="bi-geo-alt" label={strings.detail.venueLabel} value={video.location} />
                            {isLive && viewerCount !== null ? (
                                <SidebarInfoRow icon="bi-eye" label={strings.detail.viewersLabel} value={String(viewerCount)} tone={theme.static.colorAccent} />
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* --- Related events --- */}
                {related.length ? (
                    <Row
                        title={strings.detail.relatedEvents}
                        items={related.map((v) => ({
                            id: v.id,
                            title: v.title,
                            image: v.imageUrl,
                            status: v.status,
                            eventDate: v.eventDate,
                            startTime: v.startTime,
                            location: v.location,
                            hostName: v.hostName,
                            streamFee: v.streamFee,
                            streamFeeCurrencySymbol: v.streamFeeCurrencySymbol,
                        }))}
                        onSelect={(item) => router.push(`/detail?id=${item.id}`)}
                    />
                ) : null}

                {/* --- Footer --- */}
                <Text style={[styles.footer, { color: theme.static.colorTextSecondary }]}>
                    © {new Date().getFullYear()} Connekyt · {strings.detail.footerTagline}
                </Text>
            </ScrollView>

            {reserveOpen ? (
                <ReserveQrModal
                    // Device-based pay-to-watch QR — the payment binds to THIS TV
                    // (guest-friendly, no mix-ups) and unlocks the stream-access
                    // the TV checks. Falls back to the account package page only
                    // until the device id has loaded.
                    url={
                        deviceId
                            ? `${PAY_TO_WATCH_BASE_URL}?eventId=${encodeURIComponent(video.id)}&device=${encodeURIComponent(deviceId)}`
                            : `${WEB_BASE}/user/events/join-package?id=${video.id}`
                    }
                    priceLabel={isFreeEntry ? undefined : priceLabel}
                    onClose={() => setReserveOpen(false)}
                />
            ) : null}

            {shareOpen ? (
                <ShareQrModal
                    url={`${WEB_BASE}/user/events/join-package?id=${video.id}`}
                    onClose={() => setShareOpen(false)}
                />
            ) : null}

            {paidSuccess ? (
                <View style={styles.successOverlay} pointerEvents="none">
                    <View style={[styles.successCard, { backgroundColor: theme.static.colorSurface, borderColor: theme.static.colorBorder }]}>
                        <i className="bi bi-check-circle-fill" style={{ fontSize: 48, color: theme.static.colorSuccess }} />
                        <Text style={[styles.successTitle, { color: theme.static.colorTextPrimary }]}>{strings.detail.paymentSuccessTitle}</Text>
                        <Text style={[styles.successBody, { color: theme.static.colorTextSecondary }]}>{strings.detail.paymentSuccessBody}</Text>
                        <ActivityIndicator size="small" color={theme.static.colorAccent} />
                    </View>
                </View>
            ) : null}
        </ScreenWrapper>
    );
}

/** Small circular icon button for the hero's top-right (share / save). */
function TopCircleButton({ icon, onPress, tint }: { icon: string; onPress: () => void; tint?: string }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[
                styles.topCircle,
                focused && { backgroundColor: theme.static.colorFocusRing, transform: [{ scale: 1.08 }] },
            ]}
        >
            <i className={`bi ${icon}`} style={{ fontSize: 17, color: focused ? '#fff' : tint ?? '#fff' }} />
        </TouchableOpacity>
    );
}

/** Icon + text item in the hero's inline meta row. */
function MetaItem({ icon, text, tone }: { icon: string; text: string; tone?: string }) {
    const { theme } = useContext(ThemeContext);
    return (
        <View style={styles.metaItem}>
            <i className={`bi ${icon}`} style={{ fontSize: 15, color: tone ?? theme.static.colorAccentLight }} />
            <Text style={[styles.metaText, { color: tone ?? theme.static.colorTextSecondary }]}>{text}</Text>
        </View>
    );
}

/** Action-bar button — primary (filled brand) or secondary (glass), with an
 *  optional inline price shown after a divider (e.g. "Reserve your spot | 100 RWF"). */
function ActionButton({
    title,
    icon,
    price,
    onPress,
    disabled,
    hasTVPreferredFocus,
    variant,
}: {
    title: string;
    icon: string;
    price?: string;
    onPress: () => void;
    disabled?: boolean;
    hasTVPreferredFocus?: boolean;
    variant: 'primary' | 'secondary';
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    const isPrimary = variant === 'primary';
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            hasTVPreferredFocus={hasTVPreferredFocus}
            {...focusProps}
            style={[
                styles.actionButton,
                isPrimary
                    ? styles.actionPrimary
                    : { backgroundColor: 'rgba(22,36,60,0.66)', borderColor: theme.static.colorBorder },
                focused && (isPrimary
                    ? { borderColor: '#fff', transform: [{ scale: 1.05 }] }
                    : { borderColor: theme.static.colorFocusRing, transform: [{ scale: 1.05 }], backgroundColor: 'rgba(22,36,60,0.92)' }),
                disabled && { opacity: 0.55 },
            ]}
        >
            <i className={`bi ${icon}`} style={{ fontSize: 17, color: isPrimary ? '#fff' : theme.static.colorSuccess }} />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>{title}</Text>
            {price ? (
                <>
                    <View style={styles.actionDivider} />
                    <Text style={[styles.actionPrice, { color: '#fff' }]}>{price}</Text>
                </>
            ) : null}
        </TouchableOpacity>
    );
}

/** QR to open this event on a phone — the app's standard "continue on your phone" handoff, reused for share. */
function ShareQrModal({ url, onClose }: { url: string; onClose: () => void }) {
    const { strings } = useTranslation();
    return (
        <QrHandoffCard
            url={url}
            icon="bi-share-fill"
            title={strings.detail.shareTitle}
            subtitle={strings.detail.shareBody}
            steps={[{ icon: 'bi-camera', text: strings.detail.scanStepCamera }]}
            onClose={onClose}
        />
    );
}

/** QR handoff for reserving a paid upcoming event — the phone finishes the
 *  package selection + payment on the Connekyt web app (a remote can't).
 *  Same wide layout as the player's Watch-Live pay gate. */
function ReserveQrModal({ url, priceLabel, onClose }: { url: string; priceLabel?: string; onClose: () => void }) {
    const { strings } = useTranslation();
    return (
        <QrHandoffCard
            url={url}
            icon="bi-calendar-check-fill"
            title={strings.detail.reserveTitle}
            subtitle={strings.detail.reserveBody}
            priceLabel={priceLabel}
            steps={[
                { icon: 'bi-camera', text: strings.detail.scanStepCamera },
                { icon: 'bi-credit-card', text: strings.detail.reserveStepPay },
            ]}
            waitingText={strings.detail.reserveWaiting}
            onClose={onClose}
        />
    );
}

function SectionHeader({ label }: { label: string }) {
    const { theme } = useContext(ThemeContext);
    return <Text style={[styles.sectionHeader, { color: theme.static.colorTextPrimary }]}>{label}</Text>;
}

function SidebarInfoRow({ icon, label, value, tone }: { icon: string; label: string; value?: string; tone?: string }) {
    const { theme } = useContext(ThemeContext);
    if (!value) return null;
    return (
        <View style={styles.sidebarInfoRow}>
            <i className={`bi ${icon}`} style={{ fontSize: 15, color: theme.static.colorTextSecondary, width: 20 }} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.sidebarInfoLabel, { color: theme.static.colorTextSecondary }]}>{label}</Text>
                <Text style={[styles.sidebarInfoValue, { color: tone ?? theme.static.colorTextPrimary }]}>{value}</Text>
            </View>
        </View>
    );
}

function HostCard({ role, name, image, icon, color }: { role: string; name: string; image?: string; icon: string; color: string }) {
    const { theme } = useContext(ThemeContext);
    return (
        <View style={[styles.hostCard, styles.glass]}>
            {image ? (
                <Image source={{ uri: image }} style={styles.hostCardAvatar} />
            ) : (
                <View style={[styles.hostCardAvatar, styles.hostCardAvatarFallback, { backgroundColor: color }]}>
                    <i className={`bi ${icon}`} style={{ fontSize: 16, color: '#fff' }} />
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text style={[styles.hostCardRole, { color: theme.static.colorTextSecondary }]}>{role.toUpperCase()}</Text>
                <Text numberOfLines={1} style={[styles.hostCardName, { color: theme.static.colorTextPrimary }]}>
                    {name}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Success overlay shown briefly after payment before redirecting to the player.
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.72)',
        zIndex: 60,
    } as object,
    successCard: {
        width: 460,
        maxWidth: '90%',
        borderRadius: 24,
        borderWidth: 1,
        padding: 40,
        alignItems: 'center',
    },
    successTitle: { fontSize: 24, fontWeight: '800', marginTop: 16, marginBottom: 8, textAlign: 'center' },
    successBody: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 20 },

    scroll: { flex: 1 },
    hero: { minHeight: '86vh', position: 'relative', justifyContent: 'flex-end' } as object,
    backdrop: { ...StyleSheet.absoluteFillObject },
    heroScrim: { ...StyleSheet.absoluteFillObject, opacity: 0.5 } as object,
    // Extra darkening along the bottom so the title + action bar stay legible
    // over any backdrop (mirrors the web page's bottom gradient).
    heroBottomFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 360,
        background: 'linear-gradient(to top, rgba(11,11,16,0.96) 0%, rgba(11,11,16,0.7) 40%, rgba(11,11,16,0) 100%)',
    } as object,
    backCircle: {
        position: 'absolute',
        top: 28,
        left: 48,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(22,36,60,0.66)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    } as object,
    topRightActions: { position: 'absolute', top: 28, right: 48, flexDirection: 'row', gap: 14, zIndex: 5 } as object,
    topCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(22,36,60,0.66)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Top-center countdown flip-card anchor (the card itself is CountdownFlipCard)
    countdownAnchor: { position: 'absolute', top: 32, alignSelf: 'center', zIndex: 5 } as object,

    heroContent: { padding: 48, paddingTop: 96, paddingBottom: 64, zIndex: 2, alignItems: 'flex-start' } as object,
    pillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 7,
        paddingHorizontal: 15,
        borderRadius: 999,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
    statusPillText: { color: '#fff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    categoryPill: { paddingVertical: 7, paddingHorizontal: 15, borderRadius: 999, backgroundColor: 'rgba(22,36,60,0.7)' },
    categoryPillText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
    heroTitle: { fontSize: 52, fontWeight: '800', marginBottom: 10, maxWidth: 1000, letterSpacing: -0.5 },
    heroSubtitle: { fontSize: 19, marginBottom: 18 },

    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 24, marginBottom: 30 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    metaText: { fontSize: 15.5, fontWeight: '600' },

    // Left-aligned action bar with full-pill buttons.
    actionBar: { flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap' },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 34,
        borderRadius: 999,
        borderWidth: 2,
    },
    // Brand gradient (navy → pink, reads purple in the middle) — the same
    // gradient the Home promo card uses; RN-web needs `backgroundImage`, not
    // `background`, for it to actually paint.
    actionPrimary: {
        backgroundImage: 'linear-gradient(180deg, #5B8CFF 0%, #3E6FD8 55%, #2F59B8 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -2px 0 rgba(0,0,0,0.22), 0 12px 26px rgba(0,0,0,0.4)',
        borderColor: 'rgba(255,255,255,0.16)',
    } as object,
    actionButtonText: { fontSize: 17, fontWeight: '700' },
    actionDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.34)', marginHorizontal: 2 },
    actionPrice: { fontSize: 17, fontWeight: '800' },

    rsvpError: { fontSize: 13, marginTop: 12, maxWidth: 560 },
    verifyHint: { fontSize: 13, lineHeight: 19, marginTop: 6, opacity: 0.85 },
    reservedNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, maxWidth: 560 },
    reservedNoteText: { fontSize: 14, fontWeight: '600', flex: 1 },

    columns: { flexDirection: 'row', gap: 32, paddingHorizontal: 48, paddingTop: 40 },
    leftColumn: { flex: 1.6 },
    rightColumn: { flex: 1, gap: 24 },

    glass: midnightGlass as object,
    card: { borderRadius: 16, padding: 24, marginBottom: 24 },

    sectionHeader: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, opacity: 0.8 },
    description: { fontSize: 15, lineHeight: 24 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
    tagPill: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
    tagText: { fontSize: 12, fontWeight: '600' },
    replayNote: { fontSize: 13, marginTop: 16, fontStyle: 'italic' },

    hostRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
    hostCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 16 },
    hostCardAvatar: { width: 40, height: 40, borderRadius: 20 },
    hostCardAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    hostCardRole: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginBottom: 2 },
    hostCardName: { fontSize: 14, fontWeight: '700' },

    priceBox: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 20 },
    priceBoxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    priceBoxTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    priceBoxSubtitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

    sidebarInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    sidebarInfoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
    sidebarInfoValue: { fontSize: 14, fontWeight: '700' },

    footer: { textAlign: 'center', fontSize: 12, paddingVertical: 40 },
});
