import React, { useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Image, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'next/router';
import Hls from 'hls.js';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext, ICON_LOGO } from '../config';
import { FocusableButton } from '../components/FocusableButton';
import { CountdownFlipCard } from '../components/CountdownFlipCard';
import { QrHandoffCard } from '../components/QrHandoffCard';
import { fetchVideoDetails, isCategoryRestricted, TvVideo } from '../api/catalog';
import { useTranslation } from '../i18n';
import { storage, StorageKeys } from '../services/storage';
import { isPlaybackQuality, resolveLevelIndex, PlaybackQuality } from '../features/playback/quality';
import { WHEPClient } from '../features/playback/whepClient';
import {
    requestStreamAccess,
    checkAnonymousStreamAccess,
    reconcileAnonymousStreamAccess,
    resolveViewerIdByFingerprint,
    confirmDeviceSession,
    sendAnonymousViewerHeartbeat,
    deactivateAnonymousViewerSession,
    checkStreamDeviceAccess,
    sendStreamHeartbeat,
} from '../features/events/api';
import { getTvDeviceId } from '../services/deviceId';
import { paidPurchasesEnabled } from '../config/policy';
import { useAuth } from '../store/auth';
import { usePlayerControls } from '../store/playerControls';
import { useFocusNav } from '../hooks/useFocusNav';
import { useBackHandler } from '../hooks/useBackHandler';
import { OnScreenKeyboard } from '../components/OnScreenKeyboard';
import { useStreamReactions, FloatingReactionsOverlay, ReactionBar, ViewerCountBadge, HideReactionsButton } from '../components/StreamReactions';
import { ChatPanel } from '../components/StreamChatPanel';
import { midnightGlass, raisedButton, glassWell } from '../components/glass/glassStyle';

// Temporary way to eyeball the player chrome (watermark, controls, auto-hide)
// against real moving footage without needing an actual live WHEP broadcast
// running. Visit /player?demo=1 for a plain test MP4, or /player?demo=youtube
// for a YouTube-embedded test video. Remove once the design is signed off.
const DEMO_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';
const YOUTUBE_DEMO_ID = 'dSBNtxUVvg8';

// knockout's public, no-login livestream page already has a full "Send Gift"
// flow (amount, mobile-money payment, its own confirmation) wired to the real
// gift endpoint — the TV just needs to point a phone at it via QR, same
// "TV shows a code, phone completes the flow" pattern as the login screen's
// QR pairing.
const GIFT_LIVESTREAM_BASE_URL = 'https://connekyt.com/user/events/livestream/';

// knockout's public donations page ("Support a Cause") — same destination the
// home screen's Donate service links to. The phone completes the donation
// there; the TV just surfaces it via QR, matching the gift/chat pattern.
const DONATE_BASE_URL = 'https://connekyt.com/user/donations';

// knockout's private, link-only "pay to watch" page (app/pay-to-watch) —
// never linked from any nav, reachable only via this QR code. It collects
// name/email/phone + runs the existing anonymous-viewer payment flow keyed
// to THIS TV's device id (see services/deviceId.ts), not the phone's own.
const PAY_TO_WATCH_BASE_URL = 'https://connekyt.com/pay-to-watch';

/** Per-event "already joined this invite-only stream" flag — mirrors knockout's
 *  `streamToken_{eventId}` localStorage key, just a boolean since we don't need
 *  to remember the code itself, only that this device already unlocked it. */
function inviteAccessKey(eventId: string): string {
    return `stream-access.${eventId}`;
}

// paidNoStream: the viewer HAS paid (hasAccess) but the backend has no
// whepUrl yet because the host hasn't started broadcasting — distinct from
// "not paid", so we show a "waiting for the stream" screen instead of the
// QR pay-gate (and never mislabel a real payment as "no payment found").
type PayCheckResult = { granted: boolean; deviceMismatch?: boolean; paidNoStream?: boolean };

/** eventDate ("YYYY-MM-DD") + startTime ("HH:MM[:SS]") → local Date, or null. */
function parseEventStart(eventDate?: string, startTime?: string): Date | null {
    if (!eventDate) return null;
    const d = new Date(`${eventDate}T${startTime ?? '00:00:00'}`);
    return Number.isNaN(d.getTime()) ? null : d;
}

export default function PlayerScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const { id, demo } = router.query;
    const isYoutubeDemo = demo === 'youtube';
    const isDemo = demo === '1' || isYoutubeDemo;

    const [video, setVideo] = useState<TvVideo | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [restricted, setRestricted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showGiftPanel, setShowGiftPanel] = useState(false);
    const [showChatPanel, setShowChatPanel] = useState(false);
    const [showDonatePanel, setShowDonatePanel] = useState(false);
    const user = useAuth((s) => s.user);
    // Free invite-only streams show a "Join Stream" gate (matching knockout's
    // web behavior) instead of auto-playing — the WHEP URL is technically
    // already present in the event details response either way (there's no
    // hard per-token security on the free-stream path), but we still gate the
    // UI/connection on a real invite code, same as the web, rather than
    // silently playing content the viewer hasn't actually joined.
    const [inviteGateOpen, setInviteGateOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [inviteSubmitting, setInviteSubmitting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    // Paid ("entry_fee") streams: unlike the invite gate above, the backend
    // genuinely withholds whepUrl until this device has paid, so there's a
    // real access-status check (not just a UI gate) before we know whether
    // to show the QR panel at all.
    const [payGateOpen, setPayGateOpen] = useState(false);
    // Back key closes whichever player overlay is open (gift/chat/donate panel
    // or the invite gate) instead of leaving playback. The pay gate is
    // deliberately NOT closable by Back — dismissing it would look like the
    // stream is free; the viewer leaves it via the on-screen close/back.
    useBackHandler(
        () => {
            if (showGiftPanel) setShowGiftPanel(false);
            else if (showChatPanel) setShowChatPanel(false);
            else if (showDonatePanel) setShowDonatePanel(false);
            else if (inviteGateOpen) setInviteGateOpen(false);
        },
        showGiftPanel || showChatPanel || showDonatePanel || inviteGateOpen,
    );
    const [payDeviceId, setPayDeviceId] = useState<string | null>(null);
    // Only ever learned via resolveViewerIdByFingerprint (see the effect
    // below) - the TV never registers itself, the phone does that on its
    // behalf. Needed for heartbeat/device-check, which both require it.
    const [payViewerId, setPayViewerId] = useState<string | null>(null);
    // Paid, but the host hasn't started broadcasting yet (hasAccess=true,
    // whepUrl still null) — we leave the QR pay-gate and show a "waiting for
    // the stream" screen, then auto-play the moment whepUrl arrives.
    const [paidAwaitingStream, setPaidAwaitingStream] = useState(false);
    // Live-ticking ms until the scheduled start, for the waiting screen's
    // countdown (mirrors knockout's "Starts in HHh MMm SSs"). null when there's
    // no usable start time or we're not in the waiting state.
    const [msUntilStart, setMsUntilStart] = useState<number | null>(null);
    // Lets the "Already paid? Check now" button trigger the same poll the
    // effect below already runs every 4s, on demand instead of waiting.
    const payCheckNowRef = useRef<(() => Promise<PayCheckResult>) | null>(null);
    const [payChecking, setPayChecking] = useState(false);
    // Manual check-now only: transient feedback so a "not paid yet" result
    // is visibly distinct from the button silently doing nothing - the
    // background 4s auto-poll stays silent either way.
    const [payCheckMessage, setPayCheckMessage] = useState<string | null>(null);
    const payCheckMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (payCheckMessageTimer.current) clearTimeout(payCheckMessageTimer.current);
        };
    }, []);
    // Tick the countdown once per second on any waiting screen — the paid
    // "you're all set" screen AND the pre-event lobby — i.e. whenever there's
    // a scheduled start and nothing is playing yet.
    useEffect(() => {
        const start = parseEventStart(video?.eventDate, video?.startTime);
        const notPlaying = !!video && !video.whepUrl && !video.videoUrl;
        if (!start || !notPlaying) { setMsUntilStart(null); return; }
        const tick = () => setMsUntilStart(start.getTime() - Date.now());
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [video?.eventDate, video?.startTime, video?.whepUrl, video?.videoUrl]);

    // Set once a heartbeat tick discovers another device took over this
    // paid session mid-watch - stops playback and explains why, rather
    // than leaving the viewer looking at a frozen/dead video.
    const [kickedMessage, setKickedMessage] = useState<string | null>(null);

    // Pre-event lobby auto-refresh: while an event isn't playable yet but
    // could still go live (upcoming, or live-but-host-hasn't-started), re-pull
    // its details every 10s so playback begins on its own the moment a stream
    // URL appears. A paid (entry_fee) event this account HASN'T purchased is
    // handled by the access-status poll below instead (to avoid double-polling
    // and to resolve payment first) — but one that's ALREADY purchased polls
    // here like any free event, so a reserved viewer waiting in the lobby
    // auto-plays the instant the stream goes live.
    useEffect(() => {
        if (isDemo || isYoutubeDemo || !video) return;
        const notPlayable = !video.whepUrl && !video.videoUrl;
        const couldGoLive = video.status === 'UPCOMING' || video.status === 'LIVE';
        const unpaidPaidStream = video.streamType === 'entry_fee' && !video.hasPurchasedAccess;
        if (!notPlayable || !couldGoLive || unpaidPaidStream) return;
        if (restricted || kickedMessage || inviteGateOpen) return;
        let active = true;
        const t = setInterval(() => {
            fetchVideoDetails(video.id)
                .then((fresh) => {
                    if (active && fresh.id) setVideo(fresh);
                })
                .catch(() => {});
        }, 10000);
        return () => {
            active = false;
            clearInterval(t);
        };
    }, [video?.id, video?.whepUrl, video?.videoUrl, video?.status, video?.streamType, video?.hasPurchasedAccess, restricted, kickedMessage, inviteGateOpen, isDemo, isYoutubeDemo]);
    // Device-local "hide the floating reactions" preference - loaded once on
    // mount, doesn't block first paint (defaults to visible).
    const [reactionsHidden, setReactionsHidden] = useState(false);
    useEffect(() => {
        storage.get(StorageKeys.reactionsHidden).then((v) => setReactionsHidden(v === '1'));
    }, []);
    useEffect(() => {
        storage.set(StorageKeys.reactionsHidden, reactionsHidden ? '1' : '0');
    }, [reactionsHidden]);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Fullscreens THIS wrapper (video/iframe + watermark + controls) rather
    // than the raw <video>/<iframe> — the Fullscreen API only shows the
    // requested element and its descendants, so fullscreening the video
    // directly (e.g. via its own native fullscreen button) would leave the
    // watermark and logo, which are siblings of it, invisible.
    const fullscreenTargetRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            fullscreenTargetRef.current?.requestFullscreen();
        }
    };

    useEffect(() => {
        if (isYoutubeDemo) {
            setVideo({
                id: 'demo-youtube',
                title: 'Demo Playback (YouTube test video — not a real event)',
                status: 'LIVE',
            });
            setRestricted(false);
            setLoading(false);
            return;
        }
        if (isDemo) {
            setVideo({
                id: 'demo',
                title: 'Demo Playback (test video — not a real event)',
                status: 'LIVE',
                videoUrl: DEMO_VIDEO_URL,
            });
            setRestricted(false);
            setLoading(false);
            return;
        }
        if (!id) return;
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
                console.error('Failed to fetch video for player', err);
                setNotFound(true);
                setLoading(false);
            });
    }, [id, isDemo, isYoutubeDemo]);

    // Once we know this event needs an invite code, check for a previously
    // granted access flag (same pattern knockout uses via localStorage) so a
    // returning viewer isn't asked to re-enter it every time.
    //
    // hasInviteCode only means *some* active stream token exists for this
    // event (e.g. a coordinator/staff token) - it isn't mutually exclusive
    // with a paid entry_fee stream, so streamType is the authoritative
    // signal (matches knockout's getStreamType precedence) and wins here.
    useEffect(() => {
        if (!video?.hasInviteCode || video.streamType === 'entry_fee') return;
        storage.get(inviteAccessKey(video.id)).then((granted) => {
            setInviteGateOpen(granted !== '1');
        });
    }, [video?.id, video?.hasInviteCode, video?.streamType]);

    // Paid event, live now, no invite code, not already unlocked -> confirm
    // this TV's device id genuinely doesn't have paid access yet (fresh
    // backend check, not a cached flag — a prior TV session on this same
    // install could already have paid), then show the QR gate and poll
    // until the phone-side payment on knockout's /pay-to-watch flips it.
    //
    // Three stages, since the TV never gets a viewerId of its own (the
    // phone completes /register using the TV's deviceId as the
    // fingerprint, so the resulting viewerId only ever reaches the
    // phone's response — see resolveViewerIdByFingerprint):
    //   1. Poll for a viewerId to exist at all under this device's fingerprint.
    //   2. Once found, poll access-status (which requires that viewerId) for hasAccess.
    //   3. Once granted, register this TV's own session (device-check) so
    //      heartbeat has something to keep alive (see the effect below).
    useEffect(() => {
        if (isDemo || isYoutubeDemo) return;
        if (!video || video.whepUrl) return;
        if (video.streamType !== 'entry_fee' || video.hasPurchasedAccess) return;
        if (video.status !== 'LIVE') return;

        let cancelled = false;
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        const eventId = video.id;

        (async () => {
            const deviceId = await getTvDeviceId();
            if (cancelled) return;
            setPayDeviceId(deviceId);

            const grantAccess = async (viewerId: string, whepUrl: string) => {
                setPayViewerId(viewerId);
                setPaidAwaitingStream(false);
                setVideo((v) => (v ? { ...v, whepUrl } : v));
                setPayGateOpen(false);
                const session = await confirmDeviceSession(eventId, viewerId, deviceId);
                if (!session.ok && session.conflict) {
                    // Vanishingly rare (fingerprint already matched to get
                    // this far - this only fires if another device raced in
                    // during the gap between checks), but don't leave the
                    // viewer stuck if it happens. Reuses the same "kicked"
                    // screen since it's the same class of message.
                    setKickedMessage(session.message ?? strings.player.kickedByOtherDevice);
                    setVideo((v) => (v ? { ...v, whepUrl: undefined } : v));
                }
            };

            // Passive check — cheap local read of the stored payment status.
            // Runs on mount and every 4s; safe to call constantly.
            const check = async (): Promise<PayCheckResult> => {
                const viewerId = await resolveViewerIdByFingerprint(eventId, deviceId);
                if (cancelled || !viewerId) return { granted: false };
                const res = await checkAnonymousStreamAccess(eventId, viewerId, deviceId);
                if (cancelled) return { granted: false };
                if (res.hasAccess && res.whepUrl) {
                    await grantAccess(viewerId, res.whepUrl);
                    if (pollTimer) clearInterval(pollTimer);
                    return { granted: true };
                }
                if (res.hasAccess) {
                    // Paid, but the host hasn't started broadcasting — swap the
                    // pay-gate for the waiting screen and keep polling so we
                    // play the instant whepUrl shows up.
                    setPayViewerId(viewerId);
                    setPaidAwaitingStream(true);
                    setPayGateOpen(false);
                    return { granted: false, paidNoStream: true };
                }
                return { granted: false, deviceMismatch: res.deviceMismatch };
            };

            // Active check — fired ONLY by the "Already paid? Check now" button
            // (see payCheckNowRef below). Makes the backend re-pull the XentriPay
            // transaction, so a real payment whose confirm-payment never landed
            // still unlocks on demand. Deliberately not used by the 4s auto-poll.
            const activeCheck = async (): Promise<PayCheckResult> => {
                const res = await reconcileAnonymousStreamAccess(eventId, deviceId);
                if (cancelled) return { granted: false };
                if (res.hasAccess && res.whepUrl && res.viewerId) {
                    await grantAccess(res.viewerId, res.whepUrl);
                    if (pollTimer) clearInterval(pollTimer);
                    return { granted: true };
                }
                if (res.hasAccess) {
                    // Confirmed paid, stream just isn't live yet — same waiting
                    // state as the passive check (never "no payment found").
                    if (res.viewerId) setPayViewerId(res.viewerId);
                    setPaidAwaitingStream(true);
                    setPayGateOpen(false);
                    return { granted: false, paidNoStream: true };
                }
                return { granted: false, deviceMismatch: res.deviceMismatch };
            };

            payCheckNowRef.current = activeCheck;

            const alreadyGranted = await check();
            if (!alreadyGranted.granted && !cancelled) {
                // Only show the QR pay-gate if genuinely unpaid; a paid viewer
                // waiting for the broadcast gets the waiting screen instead.
                if (!alreadyGranted.paidNoStream) setPayGateOpen(true);
                pollTimer = setInterval(check, 4000);
            }
        })();

        return () => {
            cancelled = true;
            payCheckNowRef.current = null;
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [video?.id, video?.hasInviteCode, video?.whepUrl, video?.streamType, video?.hasPurchasedAccess, video?.status, isDemo, isYoutubeDemo]);

    // Keeps this device's paid session alive while actually watching, and
    // doubles as kick-detection: the backend rejects the heartbeat the
    // moment another device takes over via /switch-device, so this finds
    // out within one 30s tick rather than the stream just silently dying.
    useEffect(() => {
        if (!payViewerId || !payDeviceId || !video?.whepUrl) return undefined;
        const eventId = video.id;
        let cancelled = false;

        const beat = async () => {
            const ok = await sendAnonymousViewerHeartbeat(eventId, payViewerId, payDeviceId);
            if (!cancelled && !ok) {
                setKickedMessage(strings.player.kickedByOtherDevice);
                // Tears down the WHEP connection (the playback effect below
                // is keyed on video.whepUrl) - no point holding a live
                // connection open once the backend has revoked this device.
                setVideo((v) => (v ? { ...v, whepUrl: undefined } : v));
            }
        };
        const timer = setInterval(beat, 30_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [payViewerId, payDeviceId, video?.id, video?.whepUrl, strings.player.kickedByOtherDevice]);

    // Release this device's session on the way out so it doesn't linger as
    // "active" for the next 60s and block a legitimate switch elsewhere.
    useEffect(() => {
        if (!payDeviceId || !video?.id) return undefined;
        const eventId = video.id;
        const deviceId = payDeviceId;
        return () => {
            deactivateAnonymousViewerSession(eventId, deviceId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payDeviceId, video?.id]);

    // Device-lock for a REAL logged-in account watching a paid stream it
    // already has access to (not the anonymous QR-pay flow above, which has
    // its own separate lock and already excludes this case via payViewerId).
    // Without this, a shared account could watch simultaneously on any
    // number of devices - nothing was checking. Same no-switching policy:
    // hard-blocked immediately if another device is already active, only
    // the 60s-idle path lets a different device take over.
    useEffect(() => {
        if (isDemo || isYoutubeDemo) return undefined;
        if (!user || payViewerId) return undefined;
        if (!video || video.streamType !== 'entry_fee' || !video.hasPurchasedAccess || !video.whepUrl) return undefined;

        const eventId = video.id;
        let cancelled = false;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

        (async () => {
            const deviceId = await getTvDeviceId();
            if (cancelled) return;

            const access = await checkStreamDeviceAccess(eventId, deviceId);
            if (cancelled) return;
            if (!access.ok) {
                setKickedMessage(access.message || strings.player.kickedByOtherDevice);
                setVideo((v) => (v ? { ...v, whepUrl: undefined } : v));
                return;
            }

            heartbeatTimer = setInterval(async () => {
                const ok = await sendStreamHeartbeat(eventId, deviceId);
                if (!cancelled && !ok) {
                    setKickedMessage(strings.player.kickedByOtherDevice);
                    setVideo((v) => (v ? { ...v, whepUrl: undefined } : v));
                }
            }, 30_000);
        })();

        return () => {
            cancelled = true;
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        };
    }, [isDemo, isYoutubeDemo, user, payViewerId, video?.id, video?.streamType, video?.hasPurchasedAccess, video?.whepUrl, strings.player.kickedByOtherDevice]);

    // Connect once we have both a playback URL and the <video> node. WHEP
    // (WebRTC) is the real path now — the backend dropped HLS in favor of
    // sub-second-latency Cloudflare Stream WHEP endpoints and always sends
    // videoUrl as null. hls.js only stays wired up as a fallback in case a
    // legacy videoUrl (hlsManifestUrl) ever shows up again.
    //
    // Depends on `loading`/`restricted` (not just the URLs) because the
    // data-fetch effect below calls setVideo(...) and setLoading(false) from
    // two separate renders (there's a real `await` between them) — on the
    // first of those renders `video.whepUrl` is already set but the <video>
    // element hasn't mounted yet (the component still returns the loading
    // spinner), so videoRef.current is null. Without `loading` in the deps,
    // this effect would run once on that render, bail on the null ref, and
    // never fire again once the <video> tag actually exists.
    useEffect(() => {
        if (loading || restricted || inviteGateOpen) return;
        const el = videoRef.current;
        if (!el) return;

        // Demo footage is a plain progressive MP4, not an HLS manifest or a
        // WHEP endpoint — skip both real playback paths and just play it directly.
        if (isDemo && video?.videoUrl) {
            el.src = video.videoUrl;
            return undefined;
        }

        if (video?.whepUrl) {
            const whep = new WHEPClient(video.whepUrl, el);
            return () => whep.destroy();
        }

        if (!video?.videoUrl) return undefined;

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(video.videoUrl);
            hls.attachMedia(el);
            hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
                storage.get(StorageKeys.playbackQuality).then((saved) => {
                    const quality: PlaybackQuality = isPlaybackQuality(saved) ? saved : 'auto';
                    hls.currentLevel = resolveLevelIndex(quality, data.levels);
                });
            });
            return () => hls.destroy();
        }
        // Safari/tvOS support HLS natively via the src attribute — no
        // programmatic level control there, ABR is the platform's own.
        el.src = video.videoUrl;
        return undefined;
    }, [video?.whepUrl, video?.videoUrl, loading, restricted, isDemo, inviteGateOpen]);

    const submitInviteCode = async () => {
        if (!video || !inviteCode.trim()) return;
        setInviteSubmitting(true);
        setInviteError(null);
        const viewerUsername = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Viewer';
        const res = await requestStreamAccess(video.id, inviteCode.trim(), viewerUsername);
        setInviteSubmitting(false);
        if (res.ok) {
            await storage.set(inviteAccessKey(video.id), '1');
            if (res.whepUrl) setVideo((v) => (v ? { ...v, whepUrl: res.whepUrl } : v));
            setInviteGateOpen(false);
        } else {
            setInviteError(res.message ?? strings.player.codeInvalid);
        }
    };

    const resetHideTimer = () => {
        setShowControls(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
    };

    useEffect(() => {
        resetHideTimer();
        window.addEventListener('mousemove', resetHideTimer);
        window.addEventListener('keydown', resetHideTimer);
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            window.removeEventListener('mousemove', resetHideTimer);
            window.removeEventListener('keydown', resetHideTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Hook must run unconditionally (before the early returns below), so
    // reactionsActive tolerates video still being null on the first render.
    const reactionsActive = !isDemo && !isYoutubeDemo && !!video && video.status === 'LIVE'
        && !inviteGateOpen && !payGateOpen && !!(video.whepUrl || video.videoUrl);
    const { viewerCount, floating: reactions, sendEmoji } = useStreamReactions(video?.id, reactionsActive);

    // Exposes this screen's real playback controls (the native <video> node,
    // fullscreen, chat/gift panels, reactions visibility) to the AI assistant
    // overlay, which is mounted globally in _app.tsx and has no direct access
    // to this component's refs/state. Depends on `video`/`loading`/the gate
    // flags rather than just mount, since videoRef.current is null until the
    // component actually reaches the main return below (same two-phase-render
    // reasoning as the WHEP-connect effect above).
    useEffect(() => {
        usePlayerControls.getState().register({
            video: videoRef.current,
            toggleFullscreen,
            openChat: video?.streamSlug ? () => setShowChatPanel(true) : null,
            openGift: video?.streamSlug ? () => setShowGiftPanel(true) : null,
            toggleReactions: () => setReactionsHidden((h) => !h),
        });
        return () => usePlayerControls.getState().clear();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video, loading, restricted, inviteGateOpen, payGateOpen, kickedMessage]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#F20C8F" />
            </View>
        );
    }

    if (notFound || !video) {
        return (
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                <View style={styles.center}>
                    <i className="bi bi-emoji-frown" style={{ fontSize: 40, color: theme.static.colorAccent, marginBottom: 16 }} />
                    <Text style={[styles.title, { color: theme.static.colorTextPrimary, textAlign: 'center' }]}>
                        {strings.detail.eventNotFoundTitle}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary, textAlign: 'center', maxWidth: 480 }]}>
                        {strings.detail.eventNotFoundBody}
                    </Text>
                </View>
                <View style={styles.controls}>
                    <FocusableButton title={strings.player.back} onPress={() => router.back()} hasTVPreferredFocus />
                </View>
            </View>
        );
    }

    if (restricted) {
        return (
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                <View style={styles.center}>
                    <i className="bi bi-shield-lock" style={{ fontSize: 40, color: theme.static.colorAccent, marginBottom: 16 }} />
                    <Text style={[styles.title, { color: theme.static.colorTextPrimary, textAlign: 'center' }]}>
                        {strings.detail.restrictedTitle}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary, textAlign: 'center', maxWidth: 480 }]}>
                        {strings.detail.restrictedBody}
                    </Text>
                </View>
                <View style={styles.controls}>
                    <FocusableButton title={strings.player.back} onPress={() => router.back()} hasTVPreferredFocus />
                </View>
            </View>
        );
    }

    if (kickedMessage) {
        return (
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                <View style={styles.center}>
                    <i className="bi bi-tv" style={{ fontSize: 40, color: theme.static.colorError, marginBottom: 16 }} />
                    <Text style={[styles.title, { color: theme.static.colorTextPrimary, textAlign: 'center' }]}>{video.title}</Text>
                    <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary, textAlign: 'center', maxWidth: 480 }]}>
                        {kickedMessage}
                    </Text>
                </View>
                <View style={styles.controls}>
                    <FocusableButton title={strings.player.back} onPress={() => router.back()} hasTVPreferredFocus />
                </View>
            </View>
        );
    }

    // Paid and confirmed, but the host hasn't started broadcasting yet — show
    // a reassuring "you're in, waiting for the stream" screen rather than the
    // QR pay-gate (which would wrongly imply they still need to pay). Playback
    // starts on its own once the poll picks up a whepUrl (see grantAccess).
    if (paidAwaitingStream && !video.whepUrl) {
        const countingDown = msUntilStart !== null && msUntilStart > 0;
        return (
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                {video.imageUrl ? (
                    <>
                        <Image source={{ uri: video.imageUrl }} style={StyleSheet.absoluteFillObject} blurRadius={24} />
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: 0.78 }]} />
                    </>
                ) : null}
                <View style={styles.center}>
                    <i className="bi bi-broadcast" style={{ fontSize: 44, color: theme.static.colorSuccess, marginBottom: 18 }} />
                    <Text style={[styles.title, { color: theme.static.colorTextPrimary, textAlign: 'center' }]}>
                        {strings.player.paidWaitingTitle}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary, textAlign: 'center', maxWidth: 480 }]}>
                        {strings.player.paidWaitingBody}
                    </Text>
                    {countingDown ? (
                        <CountdownFlipCard msRemaining={msUntilStart as number} style={{ marginTop: 24 }} />
                    ) : (
                        <ActivityIndicator size="small" color={theme.static.colorSuccess} style={{ marginTop: 20 }} />
                    )}
                </View>
                <View style={styles.controls}>
                    <FocusableButton title={strings.player.back} onPress={() => router.back()} hasTVPreferredFocus />
                </View>
            </View>
        );
    }

    // A live, paid, not-yet-purchased stream also has no whepUrl yet — that's
    // expected (see the access-check effect above), not "not live". Let the
    // main return render the black player shell + PayGatePanel instead of
    // this fallback screen.
    const awaitingPayment = !isDemo && !isYoutubeDemo
        && video.streamType === 'entry_fee' && !video.hasPurchasedAccess
        && video.status === 'LIVE';

    if (!isYoutubeDemo && !video.whepUrl && !video.videoUrl && !awaitingPayment && !inviteGateOpen) {
        // Upcoming, or live-but-the-host-hasn't-started-broadcasting: show a
        // proper "starting soon" lobby (backdrop, countdown, waiting note) and
        // let the auto-refresh poll above flip us into playback the moment a
        // stream URL appears. ENDED/CANCELLED (or an unknown state) fall back
        // to the plain "not live" line — a lobby/countdown would be wrong there.
        const canLobby = video.status === 'UPCOMING' || video.status === 'LIVE';
        const countingDown = msUntilStart !== null && msUntilStart > 0;
        return (
            <View style={[styles.container, { backgroundColor: '#000' }]}>
                {canLobby && video.imageUrl ? (
                    <>
                        <Image source={{ uri: video.imageUrl }} style={StyleSheet.absoluteFillObject} blurRadius={24} />
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: 0.78 }]} />
                    </>
                ) : null}
                <View style={styles.center}>
                    {canLobby ? (
                        <>
                            <i className="bi bi-broadcast" style={{ fontSize: 44, color: theme.static.colorSuccess, marginBottom: 18 }} />
                            <Text style={[styles.subtitle, { color: theme.static.colorAccentLight, textAlign: 'center', marginBottom: 6, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }]}>
                                {strings.player.lobbyStartingSoon}
                            </Text>
                            <Text style={[styles.title, { color: theme.static.colorTextPrimary, textAlign: 'center' }]}>{video.title}</Text>
                            <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary, textAlign: 'center', maxWidth: 480 }]}>
                                {strings.player.lobbyBody}
                            </Text>
                            {countingDown ? (
                                <CountdownFlipCard msRemaining={msUntilStart as number} style={{ marginTop: 24 }} />
                            ) : (
                                <ActivityIndicator size="small" color={theme.static.colorSuccess} style={{ marginTop: 20 }} />
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{video.title}</Text>
                            <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary }]}>
                                {strings.player.notLive}
                            </Text>
                        </>
                    )}
                </View>
                <View style={styles.controls}>
                    <FocusableButton title={strings.player.back} onPress={() => router.back()} hasTVPreferredFocus />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]} onTouchStart={resetHideTimer}>
            {/* Fullscreen target: video/iframe + watermark + controls together,
                so the watermark survives going fullscreen (see fullscreenTargetRef above). */}
            <div ref={fullscreenTargetRef} style={{ position: 'absolute', inset: 0 }}>
                {isYoutubeDemo ? (
                    // YouTube's official embed player — only used for this demo
                    // path. Real playback (WHEP live, or the plain-MP4 demo) uses
                    // our own <video> element below, since we need direct control
                    // over it (WHEP attaches a MediaStream; HLS.js needs the node).
                    // No allowFullScreen — its own fullscreen button would only
                    // show the iframe itself, not our watermark; use ours instead.
                    <iframe
                        src={`https://www.youtube.com/embed/${YOUTUBE_DEMO_ID}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1`}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                        allow="autoplay; encrypted-media; picture-in-picture"
                    />
                ) : (
                    // Real HTML5 video element (web engine) — native controls give us
                    // play/pause/seek for free; native TV builds would swap this for
                    // react-native-video / expo-video. controlsList="nofullscreen"
                    // hides the native fullscreen button for the same reason the
                    // iframe above skips allowFullScreen — see fullscreenTargetRef.
                    <video
                        ref={videoRef}
                        controls
                        controlsList="nofullscreen"
                        // Pulled out of tab order whenever ANY opaque overlay sits on
                        // top of the video - gates, but also the gift/chat panels,
                        // which are the identical "overlay over the same <video>"
                        // pattern. Otherwise this is the FIRST tab stop on the page
                        // (native controls are focusable by default) and it's
                        // invisible behind whatever overlay is open: a real
                        // remote-nav trap where the very first "next" press lands
                        // on a control nobody can see.
                        tabIndex={inviteGateOpen || payGateOpen || showGiftPanel || showChatPanel || showDonatePanel ? -1 : 0}
                        autoPlay
                        // Browsers only allow autoplay when muted (a user gesture is
                        // required for audible autoplay) — unmuted autoPlay silently
                        // fails and leaves playback stuck at 0:00. Muted-by-default,
                        // user unmutes via the native controls' speaker icon, same
                        // pattern most streaming platforms use for autoplaying video.
                        muted
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: '#000' }}
                    />
                )}

                {/* Brand watermark — always on (not tied to showControls) so it's
                    present in the frame the whole time content plays, same idea
                    as the "always visible" mark broadcasters burn into live feeds. */}
                <View style={styles.watermarkLayer} pointerEvents="none">
                    <Text style={styles.watermarkText}>AMORIA CONNEKYT</Text>
                    <Image source={ICON_LOGO} style={styles.watermarkLogo} resizeMode="contain" />
                </View>

                {!reactionsHidden ? <FloatingReactionsOverlay items={reactions} /> : null}

                {/* Hidden entirely (not just the gift button) whenever a gate is
                    open — otherwise this bar's own back/fullscreen buttons stay
                    in the tab/remote focus order underneath the gate's opaque
                    overlay: invisible, but still reachable, a real trap for
                    remote navigation (focus can land on a control you can't
                    see). Each gate renders its own back button instead. */}
                {showControls && !inviteGateOpen && !payGateOpen ? (
                    <View style={styles.overlayControls} pointerEvents="box-none">
                        <View style={styles.topBar}>
                            <BackCircleButton onPress={() => router.back()} />
                            <Text style={styles.overlayTitle}>{video.title}</Text>
                            <ViewerCountBadge count={viewerCount} />
                            {reactionsActive ? (
                                <HideReactionsButton hidden={reactionsHidden} onPress={() => setReactionsHidden((h) => !h)} />
                            ) : null}
                            <FullscreenButton isFullscreen={isFullscreen} onPress={toggleFullscreen} />
                        </View>

                        {/* Gifting/chat only make sense on an actually-live stream the
                            viewer has actually joined, and only if this event has a
                            resolvable public gift-page slug (see streamSlug on
                            TvVideo) — some events have no associated stream row yet. */}
                        {video.status === 'LIVE' && video.streamSlug ? (
                            <View style={[styles.bottomBar, reactionsActive && styles.bottomBarWithReactions]}>
                                {reactionsActive ? <ReactionBar onSend={sendEmoji} /> : null}
                                <View style={styles.actionButtonsRow}>
                                    <ChatButton onPress={() => setShowChatPanel(true)} />
                                    <DonateButton onPress={() => setShowDonatePanel(true)} />
                                    <GiftButton onPress={() => setShowGiftPanel(true)} />
                                </View>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {showGiftPanel && video.streamSlug ? (
                    <GiftQrPanel
                        streamSlug={video.streamSlug}
                        onClose={() => setShowGiftPanel(false)}
                    />
                ) : null}

                {showDonatePanel ? (
                    <DonateQrPanel onClose={() => setShowDonatePanel(false)} />
                ) : null}

                {showChatPanel && video.streamSlug ? (
                    <ChatPanel
                        eventId={video.id}
                        // ?mode=chat tells knockout's livestream page to skip
                        // rendering/starting the video entirely — otherwise
                        // scanning this QR just to reply also opens a second
                        // live audio+video stream on the phone, right next to
                        // the TV that's already playing it.
                        chatUrl={`${GIFT_LIVESTREAM_BASE_URL}${encodeURIComponent(video.streamSlug)}?mode=chat`}
                        onClose={() => setShowChatPanel(false)}
                    />
                ) : null}

                {inviteGateOpen ? (
                    <InviteGate
                        code={inviteCode}
                        onChangeCode={(v) => {
                            setInviteCode(v);
                            setInviteError(null);
                        }}
                        submitting={inviteSubmitting}
                        error={inviteError}
                        onSubmit={submitInviteCode}
                        coverImage={video.imageUrl}
                        onBack={() => router.back()}
                    />
                ) : null}

                {payGateOpen && payDeviceId ? (
                    <PayGatePanel
                        eventId={video.id}
                        deviceId={payDeviceId}
                        priceLabel={video.streamFee ? `${video.streamFee.toLocaleString()} ${video.streamFeeCurrencySymbol ?? ''}`.trim() : undefined}
                        coverImage={video.imageUrl}
                        onBack={() => router.back()}
                        checking={payChecking}
                        message={payCheckMessage}
                        onCheckNow={async () => {
                            if (payChecking) return;
                            if (payCheckMessageTimer.current) clearTimeout(payCheckMessageTimer.current);
                            if (!payCheckNowRef.current) {
                                // Effect hasn't finished wiring up yet (brief
                                // window right after this panel mounts) -
                                // without this the button just silently did
                                // nothing, which read as "broken".
                                setPayCheckMessage(strings.player.alreadyPaidNotFound);
                                payCheckMessageTimer.current = setTimeout(() => setPayCheckMessage(null), 4000);
                                return;
                            }
                            setPayChecking(true);
                            setPayCheckMessage(null);
                            const result = await payCheckNowRef.current();
                            setPayChecking(false);
                            // paidNoStream already flipped us to the waiting
                            // screen (pay-gate is closing) — never show the
                            // "no payment found" message for a real payment.
                            if (!result.granted && !result.paidNoStream) {
                                setPayCheckMessage(
                                    result.deviceMismatch
                                        ? strings.player.alreadyPaidDeviceMismatch
                                        : strings.player.alreadyPaidNotFound,
                                );
                                payCheckMessageTimer.current = setTimeout(() => setPayCheckMessage(null), 4000);
                            }
                        }}
                    />
                ) : null}
            </div>
        </View>
    );
}

function BackCircleButton({ onPress }: { onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.backCircle, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <i className="bi bi-chevron-left" style={{ fontSize: 20, color: '#fff' }} />
        </TouchableOpacity>
    );
}

function FullscreenButton({ isFullscreen, onPress }: { isFullscreen: boolean; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.backCircle, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`} style={{ fontSize: 16, color: '#fff' }} />
        </TouchableOpacity>
    );
}

function GiftButton({ onPress }: { onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[
                styles.giftButton,
                raisedButton(theme.static, 'accent', { focused }),
            ]}
        >
            <i className="bi bi-gift-fill" style={{ fontSize: 16, color: '#fff' }} />
            <Text style={styles.giftButtonText}>Send a Gift</Text>
        </TouchableOpacity>
    );
}

function ChatButton({ onPress }: { onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[
                styles.giftButton,
                midnightGlass as object,
                focused && { transform: [{ scale: 1.05 }] },
            ]}
        >
            <i className="bi bi-chat-dots-fill" style={{ fontSize: 16, color: '#fff' }} />
            <Text style={styles.giftButtonText}>Chat</Text>
        </TouchableOpacity>
    );
}

function DonateButton({ onPress }: { onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[
                styles.giftButton,
                midnightGlass as object,
                focused && { transform: [{ scale: 1.05 }] },
            ]}
        >
            <i className="bi bi-heart-fill" style={{ fontSize: 16, color: theme.static.colorAccent }} />
            <Text style={styles.giftButtonText}>Donate</Text>
        </TouchableOpacity>
    );
}

/** Optional "Support a Cause" QR — points the phone at the same public
 *  donations page the home screen's Donate service uses. Same wide layout as
 *  the Watch-Live pay gate and the reserve handoff (shared QrHandoffCard). */
function DonateQrPanel({ onClose }: { onClose: () => void }) {
    const { strings } = useTranslation();
    return (
        <QrHandoffCard
            url={DONATE_BASE_URL}
            icon="bi-heart-fill"
            title={strings.player.donateTitle}
            subtitle={strings.player.donateSubtitle}
            steps={[
                { icon: 'bi-camera', text: strings.player.scanStepCamera },
                { icon: 'bi-cash-coin', text: strings.player.donateStepAmount },
            ]}
            onClose={onClose}
            overlayZIndex={3}
        />
    );
}

function GiftQrPanel({ streamSlug, onClose }: { streamSlug: string; onClose: () => void }) {
    const { strings } = useTranslation();
    const giftUrl = `${GIFT_LIVESTREAM_BASE_URL}${encodeURIComponent(streamSlug)}`;
    return (
        <QrHandoffCard
            url={giftUrl}
            icon="bi-gift-fill"
            title={strings.player.giftTitle}
            subtitle={strings.player.giftSubtitle}
            steps={[
                { icon: 'bi-camera', text: strings.player.scanStepCamera },
                { icon: 'bi-credit-card', text: strings.player.giftStepPay },
            ]}
            onClose={onClose}
            overlayZIndex={3}
        />
    );
}

/** Hard gate for paid ("entry_fee") streams this device hasn't unlocked yet.
 *  No CLOSE button (unlike GiftQrPanel, which is an optional add-on you can
 *  dismiss) — there's real content behind this one to protect, so it can't
 *  be dismissed while still watching. It does get its own BACK button
 *  though (see InviteGate's doc comment - the shared topBar back button
 *  underneath is hidden while this is open, and its overlay swallows clicks
 *  anyway, so without one there'd be no way to leave the page at all).
 *  `eventId` + `deviceId` are baked into the QR so knockout's /pay-to-watch
 *  page can register + charge against THIS TV's device id, not the phone's. */
function PayGatePanel({
    eventId,
    deviceId,
    priceLabel,
    coverImage,
    onBack,
    onCheckNow,
    checking,
    message,
}: {
    eventId: string;
    deviceId: string;
    priceLabel?: string;
    coverImage?: string;
    onBack: () => void;
    onCheckNow: () => void;
    checking: boolean;
    message: string | null;
}) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const payUrl = `${PAY_TO_WATCH_BASE_URL}?eventId=${encodeURIComponent(eventId)}&device=${encodeURIComponent(deviceId)}`;

    return (
        <View style={styles.giftOverlay}>
            {coverImage ? <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFillObject} blurRadius={20} /> : null}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.static.colorBgPrimary, opacity: 0.72 }]} />

            <View style={styles.inviteBackWrap}>
                <BackCircleButton onPress={onBack} />
            </View>

            {paidPurchasesEnabled ? (
                <View style={[styles.payGateCard, midnightGlass as object]}>
                    {/* LEFT — the QR the phone scans */}
                    <View style={styles.payGateQrBoxLg}>
                        <QRCodeSVG value={payUrl} size={248} bgColor="#FFFFFF" fgColor="#0B0B10" level="M" />
                    </View>

                    {/* RIGHT — title, price, how-to-pay, status */}
                    <View style={styles.payGateRight}>
                        <i className="bi bi-qr-code-scan" style={{ fontSize: 30, color: theme.static.colorAccent, marginBottom: 8 }} />
                        <Text style={[styles.payGateTitleLeft, { color: theme.static.colorTextPrimary }]}>{strings.player.payGateTitle}</Text>
                        <Text style={[styles.payGateSubtitleLeft, { color: theme.static.colorTextSecondary }]}>
                            {strings.player.payGateSubtitle}
                        </Text>

                        {priceLabel ? (
                            <View style={styles.payGatePricePill}>
                                <Text style={styles.payGatePriceText}>{priceLabel}</Text>
                            </View>
                        ) : null}

                        <View style={styles.payGateOptions}>
                            <View style={styles.payGateOptionRow}>
                                <i className="bi bi-camera" style={{ fontSize: 15, color: theme.static.colorAccent }} />
                                <Text style={[styles.payGateOptionText, { color: theme.static.colorTextSecondary }]}>
                                    {strings.player.payGateOptionCamera}
                                </Text>
                            </View>
                            <View style={styles.payGateOptionRow}>
                                <i className="bi bi-phone" style={{ fontSize: 15, color: theme.static.colorAccent }} />
                                <Text style={[styles.payGateOptionText, { color: theme.static.colorTextSecondary }]}>
                                    {strings.player.payGateOptionApp}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.payGateWaitingRow}>
                            <ActivityIndicator size="small" color={theme.static.colorAccent} />
                            <Text style={[styles.payGateWaitingText, { color: theme.static.colorTextSecondary }]}>
                                {strings.player.payGateWaiting}
                            </Text>
                        </View>

                        {/* Already-paid escape hatch — this TV auto-polls every 4s
                            regardless, so this button doesn't do anything the app
                            wasn't already going to do on its own; it just gives an
                            impatient viewer (who just paid, or paid earlier under a
                            different session on this same device) an immediate,
                            visible "check right now" instead of a silent wait. */}
                        <AlreadyPaidButton onPress={onCheckNow} checking={checking} />
                        {message ? (
                            <Text style={[styles.alreadyPaidMessage, { color: theme.static.colorTextSecondary }]}>{message}</Text>
                        ) : null}
                    </View>
                </View>
            ) : (
                /* Reader mode (paidPurchasesEnabled=false): no purchase QR — store
                   builds show a neutral "access unlocks automatically" message and
                   keep only the verify-access button (checking an existing
                   entitlement is not a purchase). */
                <View style={[styles.giftCard, midnightGlass as object]}>
                    <i className="bi bi-lock-fill" style={{ fontSize: 30, color: theme.static.colorAccent, marginBottom: 8 }} />
                    <Text style={[styles.giftTitle, { color: theme.static.colorTextPrimary }]}>{strings.player.payGateReaderTitle}</Text>
                    <Text style={[styles.giftSubtitle, { color: theme.static.colorTextSecondary }]}>
                        {strings.player.payGateReaderBody}
                    </Text>

                    {priceLabel ? (
                        <View style={[styles.payGatePricePill, { alignSelf: 'center', marginBottom: 4 }]}>
                            <Text style={styles.payGatePriceText}>{priceLabel}</Text>
                        </View>
                    ) : null}

                    <AlreadyPaidButton onPress={onCheckNow} checking={checking} />
                    {message ? (
                        <Text style={[styles.alreadyPaidMessage, { color: theme.static.colorTextSecondary, textAlign: 'center' }]}>{message}</Text>
                    ) : null}
                </View>
            )}
        </View>
    );
}

function AlreadyPaidButton({ onPress, checking }: { onPress: () => void; checking: boolean }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={checking}
            {...focusProps}
            style={[
                styles.alreadyPaidButton,
                { borderColor: theme.static.colorSuccess },
                focused && { backgroundColor: 'rgba(52, 211, 153, 0.12)' },
            ]}
        >
            {checking ? (
                <ActivityIndicator size="small" color={theme.static.colorSuccess} />
            ) : (
                <i className="bi bi-shield-check" style={{ fontSize: 15, color: theme.static.colorSuccess }} />
            )}
            <Text style={[styles.alreadyPaidText, { color: theme.static.colorSuccess }]}>
                {checking ? strings.player.alreadyPaidChecking : strings.player.alreadyPaidButton}
            </Text>
        </TouchableOpacity>
    );
}

/** Gate for free invite-only streams — "Join Stream" (ticket icon, title,
 *  code input, single button), styled to match the app's own branded glass
 *  card (same as GiftQrPanel/PayGatePanel) rather than knockout's teal —
 *  this screen should read as Connekyt, not a dropped-in web component. */
function InviteGate({
    code,
    onChangeCode,
    submitting,
    error,
    onSubmit,
    coverImage,
    onBack,
}: {
    code: string;
    onChangeCode: (v: string) => void;
    submitting: boolean;
    error: string | null;
    onSubmit: () => void;
    coverImage?: string;
    onBack: () => void;
}) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const canSubmit = !submitting && !!code.trim();
    // A TV remote has no physical keyboard - same on-screen keyboard the
    // remote-login form uses, shown once the input is actually focused (not
    // on mount) so it doesn't cover the card before the viewer has navigated
    // to the field. Plain local state (not useFocusNav) for the same reason
    // login.tsx's own email/password inputs don't use it either - spreading
    // useFocusNav's focusProps.onFocus after a custom onFocus prop would
    // silently clobber it (later JSX props win), so both concerns (border
    // color + keyboard trigger) live in one handler instead.
    const [inputFocused, setInputFocused] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    const onKeyPress = (key: string) => {
        if (key === 'BACKSPACE') onChangeCode(code.slice(0, -1));
        else if (key === 'SPACE') onChangeCode(code + ' ');
        else onChangeCode(code + key.toUpperCase());
    };

    return (
        <View style={styles.giftOverlay}>
            {/* The event's own cover art, blurred full-bleed behind the card —
                same "blurred backdrop photo + dark scrim" treatment the rest of
                the app uses (ScreenWrapper, login) — instead of a flat black
                tint that has nothing to do with this specific event. */}
            {coverImage ? <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFillObject} blurRadius={20} /> : null}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.static.colorBgPrimary, opacity: 0.72 }]} />

            <View style={styles.inviteBackWrap}>
                <BackCircleButton onPress={onBack} />
            </View>

            <View style={[styles.giftCard, midnightGlass as object]}>
                <Image source={ICON_LOGO} style={styles.inviteLogo} resizeMode="contain" />
                <i className="bi bi-ticket-perforated-fill" style={{ fontSize: 36, color: theme.static.colorAccent, marginBottom: 12 }} />
                <Text style={[styles.giftTitle, { color: theme.static.colorTextPrimary }]}>{strings.player.joinStreamTitle}</Text>
                <Text style={[styles.giftSubtitle, { color: theme.static.colorTextSecondary }]}>{strings.player.joinStreamSubtitle}</Text>

                <TextInput
                    value={code}
                    onChangeText={onChangeCode}
                    onFocus={() => {
                        setInputFocused(true);
                        setKeyboardVisible(true);
                    }}
                    onBlur={() => setInputFocused(false)}
                    placeholder={strings.player.inviteCodePlaceholder}
                    placeholderTextColor={theme.static.colorTextSecondary}
                    autoCapitalize="characters"
                    hasTVPreferredFocus
                    style={[
                        styles.inviteInput,
                        glassWell(theme.static), { color: theme.static.colorTextPrimary },
                        inputFocused && { borderColor: theme.static.colorFocusRing },
                    ]}
                />
                <InviteJoinButton
                    label={submitting ? strings.player.joiningButton : strings.player.joinButton}
                    disabled={!canSubmit}
                    onPress={onSubmit}
                />

                {error ? <Text style={[styles.inviteErrorText, { color: theme.static.colorError }]}>{error}</Text> : null}
            </View>

            {keyboardVisible ? (
                <OnScreenKeyboard onKeyPress={onKeyPress} onDone={() => setKeyboardVisible(false)} />
            ) : null}
        </View>
    );
}

function InviteJoinButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            {...focusProps}
            style={[
                styles.inviteJoinButton,
                raisedButton(theme.static, 'primary', { focused, disabled }),
            ]}
        >
            <Text style={[styles.inviteJoinButtonText, { color: '#fff' }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 18,
    },
    controls: {
        position: 'absolute',
        bottom: 48,
        left: 48,
        right: 48,
        alignItems: 'center',
    },
    overlayControls: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        paddingTop: 32,
        paddingHorizontal: 32,
        // Extra clearance (not just 32px, same as the other edges) so the
        // reaction bar + gift button don't sit on top of the native <video
        // controls> bar (play/scrubber/time) rendered by the browser itself
        // at the very bottom of the video.
        paddingBottom: 88,
        zIndex: 2,
    } as object,
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    backCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(22,36,60,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(170,195,240,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlayTitle: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1 },
    watermarkLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1 } as object,
    watermarkText: {
        color: '#fff',
        opacity: 0.16,
        fontSize: 42,
        fontWeight: '800',
        letterSpacing: 6,
    },
    watermarkLogo: {
        position: 'absolute',
        top: 24,
        right: 28,
        width: 64,
        height: 64,
        opacity: 0.65,
    } as object,
    bottomBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    bottomBarWithReactions: { justifyContent: 'space-between' },
    actionButtonsRow: { flexDirection: 'row', gap: 10 },
    giftButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 999,
    },
    giftButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    giftOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 3,
    } as object,
    giftCard: {
        width: 340,
        borderRadius: 20,
        borderWidth: 1,
        padding: 32,
        alignItems: 'center',
        position: 'relative',
    },
    giftCloseButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 9999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    giftTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
    giftSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    giftQrBox: {
        width: 232,
        height: 232,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    // Wide two-column pay gate (QR left · details right) — TVs are landscape,
    // so a horizontal card uses the space far better than a tall column.
    payGateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 40,
        width: 760,
        maxWidth: '92%',
        borderRadius: 24,
        borderWidth: 1,
        padding: 40,
        position: 'relative',
    },
    payGateQrBoxLg: {
        width: 288,
        height: 288,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    payGateRight: { flex: 1, alignItems: 'flex-start' },
    payGateTitleLeft: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.4 },
    payGateSubtitleLeft: { fontSize: 15, textAlign: 'left', lineHeight: 22, marginBottom: 20 },
    payGatePricePill: {
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: 'rgba(242,12,143,0.14)',
        marginBottom: 20,
    },
    payGatePriceText: { color: '#FF6FBF', fontSize: 16, fontWeight: '800' },
    payGateOptions: { alignSelf: 'stretch', gap: 10, marginBottom: 4 },
    payGateOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-start' },
    payGateOptionText: { fontSize: 13, fontWeight: '600' },
    payGateWaitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
    payGateWaitingText: { fontSize: 13, fontWeight: '600' },
    alreadyPaidButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
        width: '100%',
        borderWidth: 1,
        borderRadius: 9999,
        paddingVertical: 12,
    },
    alreadyPaidText: { fontSize: 13, fontWeight: '700' },
    alreadyPaidMessage: { fontSize: 12, textAlign: 'left', marginTop: 10 },
    inviteBackWrap: { position: 'absolute', top: 32, left: 32, zIndex: 1 } as object,
    inviteLogo: { width: 40, height: 40, marginBottom: 12 },
    inviteInput: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        marginBottom: 12,
    },
    inviteJoinButton: { width: '100%', paddingVertical: 14, alignItems: 'center' },
    inviteJoinButtonText: { fontSize: 14, fontWeight: '700' },
    inviteErrorText: { fontSize: 13, textAlign: 'center', marginTop: 12 },
});
