import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext, ICON_LOGO } from '../config';
import { useAuth } from '../store/auth';
import { useFocusNav } from '../hooks/useFocusNav';
import { useBackHandler } from '../hooks/useBackHandler';
import { useTranslation } from '../i18n';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { Row } from '../components/Row';
import { platformExit } from '../utils/platformExit';
import { fetchCategories, TvCategory } from '../api/catalog';

const WEB_BASE = 'https://connekyt.com';
// The hero row is 3 fixed showcase tiles (2 video, 1 photo) — no real event
// data. Real events still populate the "Live Now"/"Coming Up" rows below.
const VIDEO_HERO_SRC = '/videos/screen3.mp4';
const PROMO_VIDEO_SRC = '/videos/live-stream-2.mp4';
const PROMO_PHOTO_SRC = '/images/photograph.png';
const SUPPORT_PHONE = '+250 788 437 347';
const SUPPORT_EMAIL = 'info@connekyt.com';
const FAMILY_IMAGE_SRC = '/images/feature1.png';
const SHOWCASE_VIDEO_SRC = '/videos/cameraone.mp4';

const SHOWCASE_IMAGES = {
    donate: '/images/feature2-donate.jpg',
};

type ServiceKey = 'photos' | 'book' | 'live' | 'donate';

const SERVICE_IMAGES: Record<ServiceKey, string> = {
    photos: '/images/photos-innovative.jpg',
    book: '/images/booking-innovative.jpg',
    live: '/images/live-innovative.jpg',
    donate: '/images/donate-innovative.jpg',
};

/**
 * Modeled on CANAL+'s own web dashboard (canalplus.com) at the user's
 * request: nav straight into a hero row of large landscape tiles (real
 * events), a row of bold branded genre/service tiles, then curated content
 * rows — not a marketing/promo landing page. No "Welcome to Connekyt"
 * heading or announcement banner, same as the reference.
 */
export default function HomeScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const status = useAuth((s) => s.status);
    const bootstrap = useAuth((s) => s.bootstrap);

    const [activeService, setActiveService] = useState<ServiceKey | null>(null);
    const [categories, setCategories] = useState<TvCategory[]>([]);
    const [contentLoading, setContentLoading] = useState(true);
    const [exitPrompt, setExitPrompt] = useState(false);
    const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Back key closes the service QR modal instead of leaving the page.
    useBackHandler(() => setActiveService(null), activeService !== null);

    // Home is the app's root. Back here doesn't go "back" (there's nowhere
    // sensible to return to) — it follows the TV convention of "press Back
    // again to exit": first press shows a brief prompt, a second press within
    // ~3s exits the app (real exit on Tizen/webOS; no-op on plain web). Only
    // armed when no modal is open, so the service-QR modal's own Back-to-close
    // still takes priority.
    useBackHandler(() => {
        if (exitPrompt) {
            if (exitTimer.current) clearTimeout(exitTimer.current);
            platformExit();
            return;
        }
        setExitPrompt(true);
        exitTimer.current = setTimeout(() => setExitPrompt(false), 3000);
    }, status === 'authenticated' && activeService === null);

    useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

    useEffect(() => {
        if (status === 'idle') bootstrap();
    }, [status, bootstrap]);

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        let active = true;
        fetchCategories()
            .then((cats) => {
                if (!active) return;
                setCategories(cats);
                setContentLoading(false);
            })
            .catch(() => active && setContentLoading(false));
        return () => {
            active = false;
        };
    }, [status]);

    if (status !== 'authenticated') {
        return (
            <ScreenWrapper noPadding>
                <Navbar />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#F20C8F" />
                </View>
            </ScreenWrapper>
        );
    }

    const SERVICES: { key: ServiceKey; icon: string; label: string; title: string; body: string; url?: string }[] = [
        {
            key: 'photos',
            icon: 'bi-images',
            label: strings.home.servicePhotosLabel,
            title: strings.home.servicePhotosTitle,
            body: strings.home.servicePhotosBody,
            url: `${WEB_BASE}/user/browse-photos`,
        },
        {
            key: 'book',
            icon: 'bi-camera-fill',
            label: strings.home.serviceBookLabel,
            title: strings.home.serviceBookTitle,
            body: strings.home.serviceBookBody,
            url: `${WEB_BASE}/user/photographers`,
        },
        {
            key: 'live',
            icon: 'bi-broadcast',
            label: strings.home.serviceLiveLabel,
            title: strings.home.serviceLiveTitle,
            body: strings.home.serviceLiveBody,
        },
        {
            key: 'donate',
            icon: 'bi-heart-fill',
            label: strings.home.serviceDonateLabel,
            title: strings.home.serviceDonateTitle,
            body: strings.home.serviceDonateBody,
            url: `${WEB_BASE}/user/donations`,
        },
    ];

    const activeServiceData = SERVICES.find((s) => s.key === activeService) ?? null;

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
                <HeroRow
                    videoTitle={strings.home.heroVideoTitle}
                    photoTitle={strings.home.heroPhotoTitle}
                    liveVideoTitle={strings.home.heroLiveVideoTitle}
                />

                <View style={styles.genreRow}>
                    {SERVICES.map((service, i) => (
                        <GenreTile
                            key={service.key}
                            icon={service.icon}
                            label={service.label}
                            image={SERVICE_IMAGES[service.key]}
                            hasTVPreferredFocus={i === 0}
                            onPress={() => (service.url ? setActiveService(service.key) : router.push('/events'))}
                        />
                    ))}
                </View>

                <PromoBanner />

                <FeatureGrid />

                {!contentLoading &&
                    categories.map((category) => (
                        <Row
                            key={category.id}
                            title={category.title}
                            items={category.videos.map((v) => ({
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
                    ))}

                <PhotoFeatureGrid />

                <PageFooter />
            </ScrollView>

            {activeServiceData?.url ? (
                <ServiceQrModal
                    icon={activeServiceData.icon}
                    title={activeServiceData.title}
                    body={activeServiceData.body}
                    url={activeServiceData.url}
                    onClose={() => setActiveService(null)}
                />
            ) : null}

            {exitPrompt ? (
                <View style={styles.exitToast} pointerEvents="none">
                    <i className="bi bi-box-arrow-right" style={{ fontSize: 16, color: '#fff' }} />
                    <Text style={styles.exitToastText}>{strings.home.exitPrompt}</Text>
                </View>
            ) : null}
        </ScreenWrapper>
    );
}

/** 3 fixed showcase tiles — CANAL+'s own featured-show row (canalplus.com)
 *  at the user's request for the look (full-bleed key art, a bottom
 *  gradient scrim, a bold title overlay, a small brand badge in the
 *  corner), but backed by fixed demo assets rather than real event data:
 *  no live/upcoming events have existed to feature reliably, so this reads
 *  as a stable "what Connekyt does" showcase instead of a row that's
 *  sometimes full and sometimes nearly empty. */
function HeroRow({ videoTitle, photoTitle, liveVideoTitle }: { videoTitle: string; photoTitle: string; liveVideoTitle: string }) {
    return (
        <View style={styles.heroRow}>
            <VideoHeroTile src={VIDEO_HERO_SRC} fit="contain" title={videoTitle} />
            <ImageHeroTile src={PROMO_PHOTO_SRC} title={photoTitle} />
            <VideoHeroTile src={PROMO_VIDEO_SRC} fit="cover" title={liveVideoTitle} />
        </View>
    );
}

/** A looping demo clip standing in for a real event poster — used for both
 *  the first hero slot (Amoria Connekyt's face-search onboarding clip,
 *  `screen3.mp4`, a square 720x720 recording — `contain` letterboxes it
 *  rather than cropping, the same portrait/crop mistake already fixed for
 *  event posters in Row.tsx) and the last slot (`live-stream-2.mp4`, a
 *  portrait 720x1280 clip — `cover` crops it to fill the 16:9 frame, same
 *  as any other landscape hero tile). RN's <Image> can't play video, so
 *  this renders a plain HTML <video> tag directly (safe here since the
 *  whole app is react-native-web on Next.js). Purely a static/ambient
 *  showcase tile — not pressable and not TV-focusable, unlike every other
 *  hero/genre tile. */
function VideoHeroTile({ src, fit, title }: { src: string; fit: 'contain' | 'cover'; title: string }) {
    return (
        <View style={styles.heroTile}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0B0B10' }]} />
            <video
                src={src}
                autoPlay
                muted
                loop
                playsInline
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: fit }}
            />
            <View style={styles.heroScrim} />
            <Text numberOfLines={2} style={styles.heroTitle}>{title}</Text>
            <View style={styles.heroBrandBadge}>
                <Text style={styles.heroBrandText}>CONNEKYT</Text>
            </View>
        </View>
    );
}

/** Middle hero slot: a static promo photo (the same asset the PromoBanner
 *  below uses), styled like the two video tiles either side of it — same
 *  "static/ambient showcase" treatment, not pressable/focusable. */
function ImageHeroTile({ src, title }: { src: string; title: string }) {
    return (
        <View style={styles.heroTile}>
            <Image source={{ uri: src }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={styles.heroScrim} />
            <Text numberOfLines={2} style={styles.heroTitle}>{title}</Text>
            <View style={styles.heroBrandBadge}>
                <Text style={styles.heroBrandText}>CONNEKYT</Text>
            </View>
        </View>
    );
}

/** Photo-backed service tiles — same visual language as the hero row
 *  (full-bleed image, bottom gradient scrim, bold label) so the genre row
 *  reads as a continuation of the hero strip rather than a separate flat
 *  icon grid. `flex: 1` on each tile (see styles.genreTile) makes all 4
 *  share the row's full width evenly, whatever that width is — no fixed
 *  pixel width, so there's no dead space to the row's right on a wide TV. */
function GenreTile({
    icon,
    label,
    image,
    onPress,
    hasTVPreferredFocus,
}: {
    icon: string;
    label: string;
    image: string;
    onPress: () => void;
    hasTVPreferredFocus?: boolean;
}) {
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            hasTVPreferredFocus={hasTVPreferredFocus}
            {...focusProps}
            style={[styles.genreTile, focused && styles.genreTileFocused]}
        >
            <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={styles.genreScrim} />
            <View style={styles.genreIconBadge}>
                <i className={`bi ${icon}`} style={{ fontSize: 15, color: '#fff' }} />
            </View>
            <Text style={styles.genreTileText}>{label}</Text>
        </TouchableOpacity>
    );
}

/** Full-width marketing strip between the genre row and the content rows —
 *  a quick "here's what Connekyt actually does, everywhere" pitch. The
 *  phone-shaped frame on the right shows a static promo photo; purely
 *  decorative, not pressable. */
function PromoBanner() {
    const { strings } = useTranslation();
    return (
        <View style={styles.promoBanner}>
            <View style={styles.promoLeft}>
                <View style={styles.promoLiveBadge}>
                    <View style={styles.promoLiveDot} />
                    <Text style={styles.promoLiveText}>{strings.home.promoLive}</Text>
                </View>
                <Text style={styles.promoBrand}>Connekyt</Text>
                <View style={styles.promoUnderline} />
                <Text style={styles.promoTagline}>{strings.home.promoTagline1}</Text>
                <Text style={styles.promoTagline}>
                    {strings.home.promoTagline2} <Text style={styles.promoTaglineHighlight}>{strings.home.promoTaglineHighlight}</Text>
                </Text>
                <Text style={styles.promoSubtitle}>{strings.home.promoSubtitle}</Text>

                <View style={styles.promoChipRow}>
                    <View style={styles.promoChip}>
                        <i className="bi bi-person-bounding-box" style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }} />
                        <Text style={styles.promoChipText}>{strings.home.promoChipSearch}</Text>
                    </View>
                    <View style={styles.promoChip}>
                        <i className="bi bi-shield-lock-fill" style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }} />
                        <Text style={styles.promoChipText}>{strings.home.promoChipPayments}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.promoStack}>
                <PromoStackCard src={SERVICE_IMAGES.book} style={styles.promoStackCardLeft} />
                <PromoStackCard src={SERVICE_IMAGES.photos} style={styles.promoStackCardCenter} />
                <PromoStackCard src={SERVICE_IMAGES.live} style={styles.promoStackCardRight} />
            </View>
        </View>
    );
}

/** One card in the fanned 3-photo stack — same order as the tagline above it
 *  (Book photographers / Buy your photos / Watch live), reusing the exact
 *  photos already picked for those 3 genre tiles so the promo card doesn't
 *  need its own separate image set. */
function PromoStackCard({ src, style }: { src: string; style: object }) {
    return (
        <View style={[styles.promoStackCard, style]}>
            <Image source={{ uri: src }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={styles.promoPhoneScrim} />
        </View>
    );
}

/** 4-card bento grid below the promo banner — a tall "family" card on the
 *  left (a photo, revealed only on TV remote focus — see FamilyFeatureCard)
 *  plus 3 stacked cards on the right (one wide, two split), each pairing a
 *  small dashed eyebrow label with a bold one-line claim. The 3 right-hand
 *  cards are purely informational, same as the promo banner above — not
 *  pressable; the left card is the one exception (focusable for its
 *  reveal-on-focus effect, see below). */
function FeatureGrid() {
    const { strings } = useTranslation();
    return (
        <View style={styles.featureGrid}>
            <FamilyFeatureCard />

            <View style={styles.featureRightCol}>
                <View style={[styles.featureCard, styles.featureCardWide, styles.featureCardAccent]}>
                    <View style={styles.featureCardBody}>
                        <FeatureEyebrow label={strings.home.featureLiveEyebrow} />
                        <Text style={styles.featureHeading}>{strings.home.featureLiveTitle}</Text>
                        <Text style={styles.featureBody}>{strings.home.featureLiveBody}</Text>
                    </View>
                    <i className="bi bi-broadcast-pin" style={{ fontSize: 44, color: 'rgba(255,255,255,0.18)' }} />
                </View>

                <View style={styles.featureRow}>
                    <View style={[styles.featureCard, styles.featureCardHalf, styles.featureCardAccent]}>
                        <View style={styles.featureCardBody}>
                            <FeatureEyebrow label={strings.home.featurePricingEyebrow} />
                            <Text style={styles.featureHeading}>{strings.home.featurePricingTitle}</Text>
                            <Text style={styles.featureBody}>{strings.home.featurePricingBody}</Text>
                        </View>
                    </View>
                    <View style={[styles.featureCard, styles.featureCardHalf, styles.featureCardAccent]}>
                        <View style={styles.featureCardBody}>
                            <FeatureEyebrow label={strings.home.featurePaymentEyebrow} />
                            <Text style={styles.featureHeading}>{strings.home.featurePaymentTitle}</Text>
                            <Text style={styles.featureBody}>{strings.home.featurePaymentBody}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

/** FeatureGrid's tall left card — a full-bleed photo instead of the old
 *  icon grid, with its eyebrow/heading/body always shown over a scrim (same
 *  as its three sibling cards, which all keep their text visible). Purely
 *  informational, not pressable. */
function FamilyFeatureCard() {
    const { strings } = useTranslation();
    return (
        <View style={[styles.featureCard, styles.featureCardTall, styles.featureCardAccent, styles.familyCard]}>
            <Image source={{ uri: FAMILY_IMAGE_SRC }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={styles.photoFeatureScrim} />
            <View style={styles.photoFeatureBody}>
                <FeatureEyebrow label={strings.home.familyEyebrow} />
                <Text style={styles.featureHeading}>{strings.home.familyTitle}</Text>
                <Text style={styles.featureBody}>{strings.home.familyBody}</Text>
            </View>
        </View>
    );
}

function FeatureEyebrow({ label }: { label: string }) {
    return (
        <View style={styles.featureEyebrowRow}>
            <View style={styles.featureEyebrowDash} />
            <Text style={styles.featureEyebrowText}>{label}</Text>
        </View>
    );
}

/** Same asymmetric shape as FeatureGrid above (now mirrored — the tall card
 *  sits on the right, three smaller ones on the left) but each card is a
 *  full-bleed photo instead of an icon-and-text glass card, and carries no
 *  pink accent border — the photos plus this section's own heading are
 *  what set it apart from FeatureGrid, not a repeat of that pink-bordered
 *  card treatment. Real gaps between every card, same as FeatureGrid's own
 *  spacing, so nothing reads as touching/overlapping. Purely informational
 *  — not pressable. */
function PhotoFeatureGrid() {
    const { strings } = useTranslation();
    return (
        <View style={styles.mosaicWrap}>
            <Text style={styles.mosaicHeading}>{strings.home.showcaseSectionTitle}</Text>
            <View style={styles.photoGrid}>
                <View style={styles.photoGridLeftCol}>
                    <PhotoFeatureCard image={FAMILY_IMAGE_SRC} cardStyle={[styles.photoCard, styles.photoCardWide]} />

                    <View style={styles.photoGridRow}>
                        <TipsCard />
                        <PhotoFeatureCard
                            image={SHOWCASE_IMAGES.donate}
                            cardStyle={[styles.photoCard, styles.photoCardHalf]}
                            eyebrow={strings.home.showcaseDonateEyebrow}
                            title={strings.home.showcaseDonateTitle}
                            body={strings.home.showcaseDonateBody}
                        />
                    </View>
                </View>

                <PhotoFeatureCard video={SHOWCASE_VIDEO_SRC} cardStyle={[styles.photoCard, styles.photoCardTall]} />
            </View>
        </View>
    );
}

function PhotoFeatureCard({
    image,
    video,
    cardStyle,
    eyebrow,
    title,
    body,
}: {
    image?: string;
    /** Looping muted demo clip instead of a still — same ambient <video>
     *  treatment as the hero row's own tiles (RN's Image can't play video,
     *  and this app only runs on react-native-web, so a raw tag is safe). */
    video?: string;
    cardStyle: object[];
    /** All three optional — omitting them makes this a media-only card (no
     *  text overlay, and no scrim, since the scrim only exists to keep
     *  overlaid text legible). */
    eyebrow?: string;
    title?: string;
    body?: string;
}) {
    const hasText = !!(eyebrow || title || body);
    return (
        <View style={cardStyle}>
            {video ? (
                <video
                    src={video}
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            )}
            {hasText ? (
                <>
                    <View style={styles.photoFeatureScrim} />
                    <View style={styles.photoFeatureBody}>
                        {eyebrow ? <FeatureEyebrow label={eyebrow} /> : null}
                        {title ? <Text style={styles.featureHeading}>{title}</Text> : null}
                        {body ? <Text style={styles.featureBody}>{body}</Text> : null}
                    </View>
                </>
            ) : null}
        </View>
    );
}

/** Auto-cycling "Quick Tip" card in the showcase grid — one short usage tip
 *  at a time, rotating every few seconds with a fade+slide entrance, to help
 *  first-time users learn what the TV app can do. A gradient card (not a
 *  photo) so it reads as an app-feature callout rather than another image.
 *  Purely informational, not pressable — it advances on its own so a
 *  lean-back viewer doesn't have to touch the remote. */
function TipsCard() {
    const { strings } = useTranslation();
    const tips = [
        { icon: 'bi-mic-fill', title: strings.home.tip1Title, body: strings.home.tip1Body },
        { icon: 'bi-qr-code-scan', title: strings.home.tip2Title, body: strings.home.tip2Body },
        { icon: 'bi-person-bounding-box', title: strings.home.tip3Title, body: strings.home.tip3Body },
        { icon: 'bi-bookmark-heart-fill', title: strings.home.tip4Title, body: strings.home.tip4Body },
    ];
    const [index, setIndex] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setIndex((i) => (i + 1) % tips.length), 4200);
        return () => clearInterval(id);
    }, [tips.length]);

    const tip = tips[index];
    return (
        <View style={[styles.photoCard, styles.photoCardHalf, styles.tipsCard]}>
            {/* Connekyt logo as a faded corner watermark (brand texture)
                instead of a flat gradient fill — sits behind the content,
                oversized and bleeding off the bottom-right edge. */}
            <Image source={ICON_LOGO} style={styles.tipsLogo} resizeMode="contain" />

            <View style={styles.tipsHeader}>
                <View style={styles.featureEyebrowRow}>
                    <View style={styles.featureEyebrowDash} />
                    <Text style={styles.featureEyebrowText}>{strings.home.tipsEyebrow}</Text>
                </View>
                <View style={styles.tipsDots}>
                    {tips.map((_, i) => (
                        <View key={i} style={[styles.tipsDot, i === index && styles.tipsDotActive]} />
                    ))}
                </View>
            </View>

            {/* Raw <div> (not a RN View) so the per-cycle CSS entrance
                animation can be triggered by React remounting it on each
                `index` change — the className carries the keyframe. Its lone
                child is a RN View, so all actual layout still happens in RN. */}
            <div key={index} className="connekyt-tip-enter">
                <View style={styles.tipsBody}>
                    <View style={styles.tipsIconBadge}>
                        <i className={`bi ${tip.icon}`} style={{ fontSize: 15, color: '#fff' }} />
                    </View>
                    <Text style={styles.featureHeading}>{tip.title}</Text>
                    <Text style={styles.featureBody}>{tip.body}</Text>
                </View>
            </div>
        </View>
    );
}

/** Centered credit + support pill at the very bottom of the page — one
 *  fully-rounded capsule (not a boxy card) matching the login screen's own
 *  "Developed by Amoria Global Tech" credit (see login.tsx), with the two
 *  contact details a viewer might actually want inline alongside it,
 *  separated by thin dividers and given small gradient icon badges for
 *  polish rather than plain glyphs. Plain text, not pressable — a TV has
 *  no dialer/mail client to hand off to. */
function PageFooter() {
    const { strings } = useTranslation();
    return (
        <View style={styles.pageFooterWrap}>
            <View style={styles.pageFooter}>
                <Text style={styles.pageFooterCredit}>
                    {strings.login.developedByPrefix}
                    {'  '}
                    <Text style={styles.pageFooterBrand}>Amoria Global Tech</Text>
                </Text>

                <View style={styles.pageFooterDivider} />
                <View style={styles.pageFooterChip}>
                    <View style={styles.pageFooterChipIcon}>
                        <i className="bi bi-telephone-fill" style={{ fontSize: 11, color: '#fff' }} />
                    </View>
                    <Text style={styles.pageFooterChipValue}>{SUPPORT_PHONE}</Text>
                </View>

                <View style={styles.pageFooterDivider} />
                <View style={styles.pageFooterChip}>
                    <View style={styles.pageFooterChipIcon}>
                        <i className="bi bi-envelope-fill" style={{ fontSize: 11, color: '#fff' }} />
                    </View>
                    <Text style={styles.pageFooterChipValue}>{SUPPORT_EMAIL}</Text>
                </View>
            </View>
        </View>
    );
}

function ServiceQrModal({ icon, title, body, url, onClose }: { icon: string; title: string; body: string; url: string; onClose: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const { focused, focusProps } = useFocusNav();
    return (
        <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.static.colorSurface, borderColor: theme.static.colorBorder }]}>
                <TouchableOpacity
                    onPress={onClose}
                    hasTVPreferredFocus
                    {...focusProps}
                    style={[styles.modalClose, focused && { backgroundColor: theme.static.colorFocusRing }]}
                >
                    <i className="bi bi-x-lg" style={{ fontSize: 16, color: '#fff' }} />
                </TouchableOpacity>

                <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(242,12,143,0.14)' }]}>
                    <i className={`bi ${icon}`} style={{ fontSize: 28, color: theme.static.colorAccent }} />
                </View>
                <Text style={[styles.modalTitle, { color: theme.static.colorTextPrimary }]}>{title}</Text>
                <Text style={[styles.modalBody, { color: theme.static.colorTextSecondary }]}>{body}</Text>
                <Text style={[styles.modalCaption, { color: theme.static.colorTextSecondary }]}>{strings.home.qrCaption}</Text>

                <View style={styles.modalQrBox}>
                    <QRCodeSVG value={url} size={200} bgColor="#FFFFFF" fgColor="#0B0B10" level="M" />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    content: { paddingTop: 32, paddingBottom: 80 },

    heroRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 48, marginBottom: 32 },
    heroTile: {
        flex: 1,
        aspectRatio: 16 / 9,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1A1A24',
    },
    heroScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.2) 42%, rgba(0,0,0,0) 68%)',
    } as object,
    heroTitle: { position: 'absolute', left: 16, right: 16, bottom: 38, color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 21 },
    // Bottom-left brand watermark, same corner CANAL+'s own logo badge sits
    // in on its featured-show tiles.
    heroBrandBadge: { position: 'absolute', bottom: 14, left: 16 },
    heroBrandText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    // Photo-backed tiles, CANAL+'s CINEMA/SERIES/SPORT genre row in spirit
    // (icon + short label) but now full-bleed images rather than flat
    // gradients — not a bordered dashboard card, and no long copy on the
    // tile itself (that lives in the QR modal instead).
    genreRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 48, marginBottom: 40 },
    genreTile: {
        flex: 1,
        height: 160,
        borderRadius: 16,
        padding: 16,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1A1A24',
    },
    genreTileFocused: { transform: [{ scale: 1.03 }] },
    genreScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.05) 100%)',
    } as object,
    genreIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        marginBottom: 10,
    },
    genreTileText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },

    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        zIndex: 50,
    } as object,
    modalCard: {
        width: 360,
        borderRadius: 20,
        borderWidth: 1,
        padding: 32,
        alignItems: 'center',
        position: 'relative',
    },
    modalClose: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    modalBody: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 16, maxWidth: 280 },
    modalCaption: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
    modalQrBox: {
        width: 232,
        height: 232,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },

    promoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32,
        marginHorizontal: 48,
        marginBottom: 40,
        padding: 32,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundImage: 'linear-gradient(135deg, #0B1E4D 0%, #3B1B63 55%, #7A1458 100%)',
        overflow: 'hidden',
    } as object,
    promoLeft: { flex: 1 },
    promoLiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: '#E31B4C',
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
        marginBottom: 14,
    },
    promoLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
    promoLiveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    promoBrand: { color: '#fff', fontSize: 32, fontWeight: '800' },
    promoUnderline: { width: 56, height: 4, borderRadius: 2, backgroundColor: '#F20C8F', marginTop: 8, marginBottom: 14 },
    promoTagline: { color: 'rgba(255,255,255,0.92)', fontSize: 18, fontWeight: '700', lineHeight: 24 },
    promoTaglineHighlight: { color: '#F783C4' },
    promoSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 10, marginBottom: 18 },
    promoChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    promoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    promoChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
    // Fanned 3-photo stack filling what used to be empty space between the
    // copy and the card's right edge — width fits the widest card's
    // rightmost extent (152 left-offset + 112 width) plus a little breathing
    // room, height fits the tallest (center) card plus its vertical offset.
    promoStack: { width: 264, height: 224, flexShrink: 0, position: 'relative' },
    promoStackCard: {
        position: 'absolute',
        borderRadius: 18,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: '#05060A',
        overflow: 'hidden',
        boxShadow: '0 14px 28px rgba(0,0,0,0.5)',
    } as object,
    // Left/right cards are slightly smaller and angled away from center,
    // sitting behind it (lower zIndex) — the classic "fanned photos" look.
    // Center card is the one directly under "Buy your photos" in the
    // tagline, so it's the one that reads as the "main" photo of the three.
    promoStackCardLeft: {
        left: 0,
        top: 24,
        width: 104,
        height: 176,
        zIndex: 1,
        transform: [{ rotate: '-8deg' }],
    } as object,
    promoStackCardCenter: {
        left: 76,
        top: 0,
        width: 112,
        height: 200,
        zIndex: 3,
        transform: [{ rotate: '0deg' }],
    } as object,
    promoStackCardRight: {
        left: 152,
        top: 24,
        width: 104,
        height: 176,
        zIndex: 2,
        transform: [{ rotate: '8deg' }],
    } as object,
    promoPhoneScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 45%)',
    } as object,

    // Bento grid: one tall card (left) beside a wide card over a split pair
    // (right) — same asymmetric grid shape as the reference layout, adapted
    // to this app's dark glass-card language instead of a light theme.
    featureGrid: { flexDirection: 'row', gap: 20, marginHorizontal: 48, marginBottom: 40, alignItems: 'stretch' },
    featureCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 24,
    },
    featureCardTall: { flex: 0.85, justifyContent: 'space-between' },
    featureCardBody: {},
    // Overrides featureCard's own padding/background — this card is a
    // full-bleed photo (the image is a plain absoluteFill child), and the
    // reveal-on-focus text uses photoFeatureBody's own absolute positioning
    // + padding instead of this card's normal padded flow layout.
    familyCard: { padding: 0, overflow: 'hidden', position: 'relative' },
    featureRightCol: { flex: 1.15, gap: 20 },
    featureCardWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    featureRow: { flexDirection: 'row', gap: 20 },
    featureCardHalf: { flex: 1 },
    // Brand-pink outline instead of the reference's blue — same "this one's
    // the highlighted option" treatment, using this app's actual accent
    // color instead of copying the reference's palette.
    featureCardAccent: { borderColor: '#F20C8F', borderWidth: 1.5 },
    featureEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    featureEyebrowDash: { width: 16, height: 1.5, backgroundColor: 'rgba(255,255,255,0.4)' },
    featureEyebrowText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' },
    featureHeading: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8, lineHeight: 27 },
    featureBody: { fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 19, maxWidth: 320 },

    mosaicWrap: { marginHorizontal: 48, marginBottom: 40 },
    mosaicHeading: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 16 },
    // Real gaps (same 20px rhythm as FeatureGrid's own featureGrid/featureRow
    // above), not thin touching dividers — no card here should look like
    // it's overlapping or fused to its neighbor.
    photoGrid: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
    photoGridLeftCol: { flex: 1.15, gap: 20 },
    photoGridRow: { flexDirection: 'row', gap: 20 },
    // Shared photo-card shell — full-bleed image, no padding/background of
    // its own (the image is a plain absoluteFill sibling), and no pink
    // accent border like FeatureGrid's cards: the photos plus this
    // section's own heading are what set it apart, not another repeat of
    // that border treatment.
    photoCard: {
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1A1A24',
    },
    photoCardTall: { flex: 0.85, minHeight: 380 },
    photoCardWide: { minHeight: 170 },
    photoCardHalf: { flex: 1, minHeight: 170 },
    photoFeatureScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.05) 100%)',
    } as object,
    // Anchored to the bottom regardless of cell height — same treatment as
    // the hero row's own title overlay — rather than needing separate
    // top/bottom layout logic per cell size.
    photoFeatureBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24 },

    // Auto-cycling tips card — dark base (photoCard's #1A1A24) with the brand
    // logo watermark (see tipsLogo) instead of a flat gradient fill, plus
    // real padding + space-between so the eyebrow/dots sit top and the
    // rotating tip sits bottom, rather than photoCard's full-bleed-image
    // layout. position:relative keeps the absolutely-positioned watermark
    // scoped to this card, and content below it stacks on top by DOM order.
    tipsCard: {
        padding: 24,
        justifyContent: 'space-between',
        position: 'relative',
    },
    // Oversized, faded, bleeding off the bottom-right corner — a texture, not
    // a focal point, so the tip text stays the clear priority. overflow on
    // photoCard clips whatever spills past the rounded edge.
    tipsLogo: {
        position: 'absolute',
        right: -46,
        bottom: -46,
        width: 200,
        height: 200,
        opacity: 0.16,
    } as object,
    tipsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tipsDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tipsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
    tipsDotActive: { width: 16, backgroundColor: '#F20C8F' },
    tipsBody: {},
    tipsIconBadge: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'linear-gradient(135deg, #083A85 0%, #F20C8F 100%)',
        marginBottom: 12,
    } as object,

    pageFooterWrap: { alignItems: 'center', marginTop: 8 },
    // Fully-rounded capsule (not a boxy card) — borderRadius 999 only holds
    // that pill shape if the content stays a single row, so credit + both
    // contact chips sit inline here rather than stacked.
    pageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 18,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingVertical: 14,
        paddingHorizontal: 30,
    },
    pageFooterCredit: { fontSize: 13, fontWeight: '500', letterSpacing: 0.2, color: 'rgba(255,255,255,0.55)' },
    // Same brand→accent gradient credit treatment as the login screen's
    // own footer (see login.tsx's footerBrand).
    pageFooterBrand: {
        fontWeight: '800',
        letterSpacing: 0.2,
        backgroundImage: 'linear-gradient(90deg, #4C8DFF 0%, #F20C8F 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    } as object,
    pageFooterDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.14)' },
    pageFooterChip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pageFooterChipIcon: {
        width: 26,
        height: 26,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'linear-gradient(135deg, #083A85 0%, #F20C8F 100%)',
    } as object,
    pageFooterChipValue: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

    // "Press Back again to exit" — a centered bottom capsule that fades in on
    // the first Back press at the root screen (TV cert convention).
    exitToast: {
        position: 'absolute',
        bottom: 48,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 26,
        backgroundColor: 'rgba(11,11,16,0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        zIndex: 60,
    } as object,
    exitToastText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
});
