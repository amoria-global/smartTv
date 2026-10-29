import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { midnightGlass } from '../components/glass/glassStyle';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext } from '../config';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { FocusableButton } from '../components/FocusableButton';
import { useFocusNav } from '../hooks/useFocusNav';
import { useAuth } from '../store/auth';
import { useTranslation, LOCALES } from '../i18n';
import { listTvDevices, removeTvDevice, TvDevice } from '../features/tv/api';
import { fetchAllCategoryNames } from '../api/catalog';
import {
    AccountProfile,
    fetchAccountProfile,
    fetchStreamNotificationsEnabled,
    setStreamNotificationsEnabled,
} from '../features/account/api';
import {
    disableParentalControl,
    fetchParentalControlEnabled,
    fetchRestrictedCategories,
    setParentalPin,
    setRestrictedCategories,
    verifyParentalPin,
} from '../features/parental/api';
import { isPlaybackQuality, PlaybackQuality } from '../features/playback/quality';
import { storage, StorageKeys } from '../services/storage';

const DASHBOARD_BASE = 'https://dashboard.connekyt.com';
// Privacy Policy & Terms are now read in-app (see pages/legal.tsx) rather than
// via Linking.openURL — a TV usually has no browser to hand a URL off to.
const FAQ_URL = 'https://connekyt.com/user/help-center';
const CONTACT_URL = 'https://connekyt.com/user/contact_us';
const SUPPORT_EMAIL = 'support@amoriaconnekyt.com';
const SUPPORT_PHONE = '+250 788 437 347';
// Keep in sync with package.json's "version" — hardcoded rather than
// imported so this doesn't depend on JSON-module bundler support.
const APP_VERSION = '0.1.0';

// The TV hands account management off to the real Connekyt web dashboard
// rather than building password/billing/KYC forms for a remote control —
// each role has its own dashboard profile route.
function manageAccountUrl(customerType?: string): string {
    if (customerType === 'Photographer') return `${DASHBOARD_BASE}/user/photographer/profile`;
    if (customerType === 'Coordinator') return `${DASHBOARD_BASE}/user/event-coordinator/profile`;
    return `${DASHBOARD_BASE}/user/client/profile`;
}

function formatDate(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function formatDateTime(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(d);
}

type TabKey = 'account' | 'notifications' | 'parental' | 'playback' | 'devices' | 'privacy' | 'help' | 'about' | 'language';

export default function SettingsScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const logout = useAuth((s) => s.logout);
    const logoutAllDevices = useAuth((s) => s.logoutAllDevices);
    const user = useAuth((s) => s.user);

    const TABS: { key: TabKey; label: string; icon: string }[] = [
        { key: 'account', label: strings.settings.tabAccount, icon: 'bi-person' },
        { key: 'notifications', label: strings.settings.tabNotifications, icon: 'bi-bell' },
        { key: 'parental', label: strings.settings.tabParental, icon: 'bi-shield-lock' },
        { key: 'playback', label: strings.settings.tabPlayback, icon: 'bi-play-btn' },
        { key: 'devices', label: strings.settings.tabDevices, icon: 'bi-tv' },
        { key: 'privacy', label: strings.settings.tabPrivacy, icon: 'bi-lock' },
        { key: 'help', label: strings.settings.tabHelp, icon: 'bi-life-preserver' },
        { key: 'about', label: strings.settings.tabAbout, icon: 'bi-info-circle' },
        { key: 'language', label: strings.settings.tabLanguage, icon: 'bi-globe2' },
    ];

    const [activeTab, setActiveTab] = useState<TabKey>('account');

    // --- Parental-PIN gate: entering Settings at all is what's protected. ---
    const [parentalEnabled, setParentalEnabled] = useState<boolean | null>(null);
    const [unlocked, setUnlocked] = useState(false);

    useEffect(() => {
        fetchParentalControlEnabled()
            .then(setParentalEnabled)
            .catch(() => setParentalEnabled(false));
    }, []);

    const [avatarError, setAvatarError] = useState(false);
    const [profile, setProfile] = useState<AccountProfile | null>(null);

    const [devices, setDevices] = useState<TvDevice[] | null>(null);
    const [devicesLoading, setDevicesLoading] = useState(true);

    const [signingOutAll, setSigningOutAll] = useState(false);

    const gated = !!parentalEnabled && !unlocked;

    const loadDevices = useCallback(() => {
        setDevicesLoading(true);
        listTvDevices()
            .then((data) => setDevices(data))
            .catch(() => setDevices([]))
            .finally(() => setDevicesLoading(false));
    }, []);

    useEffect(() => {
        if (gated) return;
        loadDevices();
    }, [loadDevices, gated]);

    useEffect(() => {
        if (gated) return;
        fetchAccountProfile()
            .then(setProfile)
            .catch(() => setProfile(null));
    }, [gated]);

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    const handleLogoutAll = async () => {
        setSigningOutAll(true);
        try {
            await logoutAllDevices();
            router.replace('/login');
        } finally {
            setSigningOutAll(false);
        }
    };

    const handleRemoveDevice = async (id: string) => {
        await removeTvDevice(id);
        loadDevices();
    };

    if (parentalEnabled === null) {
        return (
            <ScreenWrapper noPadding>
                <Navbar />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.static.colorAccent} />
                </View>
            </ScreenWrapper>
        );
    }

    if (gated) {
        return (
            <ScreenWrapper noPadding>
                <Navbar />
                <LockScreen onUnlock={() => setUnlocked(true)} />
            </ScreenWrapper>
        );
    }

    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Your account';
    const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
    const memberSince = formatDate(profile?.createdAt);
    const lastLogin = formatDateTime(profile?.lastLogin);
    const isLocked = profile?.accountLocked === true;

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <View style={styles.body}>
                <View style={[styles.sidebar, { borderRightColor: theme.static.colorBorder }]}>
                    <View style={styles.sidebarHeaderRow}>
                        <TouchableOpacity onPress={() => router.push('/home')} style={styles.backButton}>
                            <i className="bi bi-arrow-left" style={{ fontSize: 18, color: theme.static.colorTextPrimary }} />
                        </TouchableOpacity>
                        <Text style={[styles.sidebarTitle, { color: theme.static.colorTextPrimary }]}>{strings.settings.title}</Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {TABS.map((tab) => (
                            <SidebarTab
                                key={tab.key}
                                icon={tab.icon}
                                label={tab.label}
                                active={activeTab === tab.key}
                                onPress={() => setActiveTab(tab.key)}
                            />
                        ))}
                    </ScrollView>
                </View>

                <ScrollView style={styles.mainContent} contentContainerStyle={styles.mainContentInner}>
                    {activeTab === 'account' && (
                        <>
                            {/* --- Account summary + Manage Account QR --- */}
                            <View style={[styles.summaryCard, styles.glass]}>
                                <View style={styles.summaryLeft}>
                                    <View style={styles.identityRow}>
                                        {user?.profilePicture && !avatarError ? (
                                            <Image
                                                source={{ uri: user.profilePicture }}
                                                style={styles.avatar}
                                                onError={() => setAvatarError(true)}
                                            />
                                        ) : (
                                            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.static.colorBrand }]}>
                                                <Text style={styles.avatarText}>{initial}</Text>
                                            </View>
                                        )}
                                        <View>
                                            <Text style={[styles.name, { color: theme.static.colorTextPrimary }]}>{name}</Text>
                                            <Text style={[styles.email, { color: theme.static.colorTextSecondary }]}>{user?.email ?? '—'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.statRow}>
                                        <Stat label={strings.settings.accountType} value={user?.customerType ?? '—'} icon="bi-person-badge" />
                                        <Stat label={strings.settings.memberSince} value={memberSince ?? '—'} icon="bi-calendar3" />
                                        <Stat
                                            label={strings.settings.status}
                                            value={isLocked ? strings.settings.locked : strings.settings.active}
                                            icon={isLocked ? 'bi-lock' : 'bi-patch-check'}
                                            tone={isLocked ? theme.static.colorError : theme.static.colorSuccess}
                                        />
                                    </View>

                                    {lastLogin ? (
                                        <Text style={[styles.lastLogin, { color: theme.static.colorTextSecondary }]}>
                                            {strings.settings.lastLoginPrefix} {lastLogin}
                                        </Text>
                                    ) : null}
                                </View>

                                <View style={styles.summaryDivider} />

                                <View style={styles.summaryRight}>
                                    <View style={styles.qrBox}>
                                        <QRCodeSVG
                                            value={manageAccountUrl(user?.customerType)}
                                            size={128}
                                            bgColor="#FFFFFF"
                                            fgColor="#0B0B10"
                                            level="M"
                                        />
                                    </View>
                                    <Text style={[styles.qrTitle, { color: theme.static.colorTextPrimary }]}>{strings.settings.manageAccount}</Text>
                                    <Text style={[styles.qrCaption, { color: theme.static.colorTextSecondary }]}>
                                        {strings.settings.qrCaption}
                                    </Text>
                                </View>
                            </View>

                            {/* --- Tip --- */}
                            <View style={[styles.tipRow, styles.glass]}>
                                <i className="bi bi-info-circle" style={{ fontSize: 18, color: theme.static.colorAccent }} />
                                <Text style={[styles.tipText, { color: theme.static.colorTextSecondary }]}>{strings.settings.tip}</Text>
                            </View>
                        </>
                    )}

                    {activeTab === 'notifications' && <NotificationsPanel />}

                    {activeTab === 'parental' && (
                        <>
                            <ParentalControlsPanel enabled={parentalEnabled} onChanged={setParentalEnabled} />
                            <CategoryLockPanel />
                        </>
                    )}

                    {activeTab === 'playback' && <PlaybackPanel />}

                    {activeTab === 'devices' && (
                        <>
                            <SectionHeader label={strings.settings.devicesSection} />
                            <View style={[styles.section, styles.glass]}>
                                <Text style={[styles.info, { color: theme.static.colorTextSecondary }]}>
                                    {strings.settings.devicesDesc}
                                </Text>
                                {devicesLoading ? (
                                    <ActivityIndicator color={theme.static.colorAccent} style={{ marginTop: 16 }} />
                                ) : !devices?.length ? (
                                    <Text style={[styles.info, { color: theme.static.colorTextSecondary, marginTop: 8 }]}>
                                        {strings.settings.noDevices}
                                    </Text>
                                ) : (
                                    devices.map((d) => (
                                        <View key={d.id} style={styles.deviceRow}>
                                            <View style={[styles.deviceIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                                                <i className="bi bi-tv" style={{ fontSize: 18, color: theme.static.colorTextPrimary }} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.deviceLabel, { color: theme.static.colorTextPrimary }]}>
                                                    {d.deviceLabel}
                                                </Text>
                                                <Text style={[styles.deviceMeta, { color: theme.static.colorTextSecondary }]}>
                                                    {strings.settings.pairedPrefix} {d.pairedAt}
                                                </Text>
                                            </View>
                                            <FocusableButton
                                                title={strings.settings.disconnect}
                                                onPress={() => handleRemoveDevice(d.id)}
                                                style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                                            />
                                        </View>
                                    ))
                                )}

                                <View style={styles.signOutGroup}>
                                    <ActionRow icon="bi-box-arrow-right" label={strings.settings.logOut} tone={theme.static.colorTextPrimary} onPress={handleLogout} />
                                    <ActionRow
                                        icon="bi-power"
                                        label={signingOutAll ? strings.settings.signingOutAll : strings.settings.signOutAll}
                                        tone={theme.static.colorError}
                                        onPress={handleLogoutAll}
                                        disabled={signingOutAll}
                                        loading={signingOutAll}
                                    />
                                </View>
                            </View>

                            <SectionHeader label={strings.settings.audioSectionHeader} />
                            <View style={[styles.section, styles.glass]}>
                                <Text style={[styles.info, { color: theme.static.colorTextSecondary }]}>{strings.settings.audioNote}</Text>
                            </View>
                        </>
                    )}

                    {activeTab === 'privacy' && (
                        <>
                            <SectionHeader label={strings.settings.privacyHeader} />
                            <View style={[styles.section, styles.glass]}>
                                <Text style={[styles.info, { color: theme.static.colorTextSecondary }]}>{strings.settings.privacyIntro}</Text>
                                <View style={styles.signOutGroup}>
                                    <ActionRow icon="bi-shield-check" label={strings.settings.privacyPolicyLink} tone={theme.static.colorTextPrimary} onPress={() => router.push('/legal?doc=privacy')} />
                                    <ActionRow icon="bi-file-earmark-text" label={strings.settings.termsLink} tone={theme.static.colorTextPrimary} onPress={() => router.push('/legal?doc=terms')} />
                                </View>
                            </View>
                        </>
                    )}

                    {activeTab === 'help' && (
                        <>
                            <SectionHeader label={strings.settings.helpHeader} />
                            <View style={[styles.section, styles.glass]}>
                                <Text style={[styles.info, { color: theme.static.colorTextSecondary }]}>{strings.settings.helpIntro}</Text>
                                <View style={styles.signOutGroup}>
                                    <ActionRow icon="bi-question-circle" label={strings.settings.faqLink} tone={theme.static.colorTextPrimary} onPress={() => Linking.openURL(FAQ_URL)} />
                                    <ActionRow icon="bi-headset" label={strings.settings.contactLink} tone={theme.static.colorTextPrimary} onPress={() => Linking.openURL(CONTACT_URL)} />
                                </View>
                            </View>

                            <View style={[styles.summaryCard, styles.glass]}>
                                <View style={styles.summaryLeft}>
                                    <Stat label={strings.settings.emailLabel} value={SUPPORT_EMAIL} icon="bi-envelope" />
                                    <View style={{ height: 16 }} />
                                    <Stat label={strings.settings.phoneLabel} value={SUPPORT_PHONE} icon="bi-telephone" />
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryRight}>
                                    <View style={styles.qrBox}>
                                        <QRCodeSVG value={CONTACT_URL} size={128} bgColor="#FFFFFF" fgColor="#0B0B10" level="M" />
                                    </View>
                                    <Text style={[styles.qrTitle, { color: theme.static.colorTextPrimary }]}>{strings.settings.scanForSupport}</Text>
                                </View>
                            </View>
                        </>
                    )}

                    {activeTab === 'about' && (
                        <>
                            <SectionHeader label={strings.settings.aboutHeader} />
                            <View style={[styles.section, styles.glass]}>
                                <InfoRow icon="bi-tag" title={strings.settings.versionLabel} description="" badge={`v${APP_VERSION}`} />
                                <View style={styles.rowDivider} />
                                <InfoRow icon="bi-check-circle" title={strings.settings.updateStatus} description={strings.settings.updateStatusDesc} />
                            </View>

                            <SectionHeader label={strings.settings.legalHeader} />
                            <View style={[styles.section, styles.glass]}>
                                <ActionRow icon="bi-shield-check" label={strings.settings.privacyPolicyLink} tone={theme.static.colorTextPrimary} onPress={() => router.push('/legal?doc=privacy')} />
                                <ActionRow icon="bi-file-earmark-text" label={strings.settings.termsLink} tone={theme.static.colorTextPrimary} onPress={() => router.push('/legal?doc=terms')} />
                            </View>
                        </>
                    )}

                    {activeTab === 'language' && <LanguagePanel />}
                </ScrollView>
            </View>
        </ScreenWrapper>
    );
}

// --- Notifications tab -------------------------------------------------------

function NotificationsPanel() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStreamNotificationsEnabled()
            .then(setEnabled)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const toggle = async () => {
        const next = !enabled;
        setEnabled(next);
        try {
            await setStreamNotificationsEnabled(next);
        } catch {
            setEnabled(!next);
        }
    };

    return (
        <>
            <SectionHeader label={strings.settings.notificationsHeader} />
            <View style={[styles.section, styles.glass]}>
                <ToggleRow
                    icon="bi-broadcast"
                    title={strings.settings.liveStreamAlerts}
                    description={strings.settings.liveStreamAlertsDesc}
                    value={enabled}
                    loading={loading}
                    onToggle={toggle}
                />
            </View>
        </>
    );
}

// --- Playback & Quality tab --------------------------------------------------

function PlaybackPanel() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const [autoplay, setAutoplay] = useState(true);
    const [quality, setQuality] = useState<PlaybackQuality>('auto');

    useEffect(() => {
        storage.get(StorageKeys.autoplayEnabled).then((v) => setAutoplay(v !== 'false'));
        storage.get(StorageKeys.playbackQuality).then((v) => {
            if (isPlaybackQuality(v)) setQuality(v);
        });
    }, []);

    const toggleAutoplay = () => {
        const next = !autoplay;
        setAutoplay(next);
        storage.set(StorageKeys.autoplayEnabled, String(next));
    };

    const chooseQuality = (q: PlaybackQuality) => {
        setQuality(q);
        storage.set(StorageKeys.playbackQuality, q);
    };

    const QUALITY_OPTIONS: { value: PlaybackQuality; title: string; description: string }[] = [
        { value: 'auto', title: strings.settings.qualityAuto, description: strings.settings.qualityAutoDesc },
        { value: 'high', title: strings.settings.qualityHigh, description: strings.settings.qualityHighDesc },
        { value: 'data-saver', title: strings.settings.qualityDataSaver, description: strings.settings.qualityDataSaverDesc },
    ];

    return (
        <>
            <SectionHeader label={strings.settings.playbackHeader} />
            <View style={[styles.section, styles.glass]}>
                <ToggleRow
                    icon="bi-play-circle"
                    title={strings.settings.autoplay}
                    description={strings.settings.autoplayDesc}
                    value={autoplay}
                    onToggle={toggleAutoplay}
                />
            </View>
            <Text style={[styles.deviceOnlyNote, { color: theme.static.colorTextSecondary, marginBottom: 32 }]}>
                {strings.settings.deviceOnlyNote}
            </Text>

            <SectionHeader label={strings.settings.streamingQuality} />
            <View style={[styles.section, styles.glass]}>
                <Text style={[styles.info, { color: theme.static.colorTextSecondary, marginBottom: 16 }]}>
                    {strings.settings.streamingQualityDesc}
                </Text>
                {QUALITY_OPTIONS.map((opt) => (
                    <SelectRow
                        key={opt.value}
                        title={opt.title}
                        description={opt.description}
                        active={quality === opt.value}
                        onPress={() => chooseQuality(opt.value)}
                    />
                ))}
            </View>
            <Text style={[styles.deviceOnlyNote, { color: theme.static.colorTextSecondary, marginBottom: 32 }]}>
                {strings.settings.deviceOnlyNote}
            </Text>

            <SectionHeader label={strings.settings.controlsHeader} />
            <View style={[styles.section, styles.glass]}>
                <InfoRow
                    icon="bi-cursor"
                    title={strings.settings.autoHideControls}
                    description={strings.settings.autoHideControlsDesc}
                    badge={strings.settings.automaticBadge}
                />
            </View>
        </>
    );
}

function SelectRow({ title, description, active, onPress }: { title: string; description: string; active: boolean; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.toggleRow, focused && { backgroundColor: 'rgba(255,255,255,0.06)' }]}
        >
            <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: theme.static.colorTextPrimary }]}>{title}</Text>
                <Text style={[styles.toggleDescription, { color: theme.static.colorTextSecondary }]}>{description}</Text>
            </View>
            {active ? <i className="bi bi-check-lg" style={{ fontSize: 18, color: theme.static.colorAccent }} /> : null}
        </TouchableOpacity>
    );
}

// --- Parental PIN lock screen (gates the whole page above) -----------------

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);

    const submit = async (candidate: string) => {
        if (candidate.length < 4 || verifying) return;
        setVerifying(true);
        setError(null);
        try {
            const valid = await verifyParentalPin(candidate);
            if (valid) {
                onUnlock();
            } else {
                setError(strings.settings.incorrectPin);
                setPin('');
            }
        } catch {
            setError(strings.settings.incorrectPin);
            setPin('');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <View style={styles.lockWrap}>
            <View style={[styles.lockCard, styles.glass]}>
                <i className="bi bi-shield-lock" style={{ fontSize: 32, color: theme.static.colorAccent, marginBottom: 12 }} />
                <Text style={[styles.lockTitle, { color: theme.static.colorTextPrimary }]}>{strings.settings.lockTitle}</Text>
                <Text style={[styles.lockSubtitle, { color: theme.static.colorTextSecondary }]}>{strings.settings.lockSubtitle}</Text>

                <Text style={[styles.pinDots, { color: theme.static.colorTextPrimary }]}>{'•'.repeat(pin.length) || ' '}</Text>
                {error ? <Text style={[styles.pinError, { color: theme.static.colorError }]}>{error}</Text> : null}

                <PinPad
                    disabled={verifying}
                    onDigit={(d) => {
                        if (pin.length >= 6) return;
                        const next = pin + d;
                        setPin(next);
                        setError(null);
                    }}
                    onBackspace={() => setPin((p) => p.slice(0, -1))}
                />

                <FocusableButton
                    title={verifying ? '…' : strings.settings.unlock}
                    onPress={() => submit(pin)}
                    style={{ backgroundColor: theme.static.colorAccent, borderColor: theme.static.colorAccent, marginTop: 20, alignSelf: 'stretch', alignItems: 'center' }}
                />
            </View>
        </View>
    );
}

// --- Parental Controls tab: set / change / turn off -------------------------

function ParentalControlsPanel({ enabled, onChanged }: { enabled: boolean; onChanged: (enabled: boolean) => void }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [activeField, setActiveField] = useState<'current' | 'new' | 'confirm'>(enabled ? 'current' : 'new');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const reset = () => {
        setEditing(false);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setError(null);
        setActiveField(enabled ? 'current' : 'new');
    };

    const setters = { current: setCurrentPin, new: setNewPin, confirm: setConfirmPin };

    const onDigit = (d: string) => {
        const setter = setters[activeField];
        setter((v) => (v.length >= 6 ? v : v + d));
        setError(null);
    };
    const onBackspace = () => setters[activeField]((v) => v.slice(0, -1));

    const submitSave = async () => {
        setError(null);
        if (newPin.length < 4) {
            setError(strings.settings.pinTooShort);
            return;
        }
        if (newPin !== confirmPin) {
            setError(strings.settings.pinMismatch);
            return;
        }
        setSaving(true);
        try {
            const res = await setParentalPin(newPin, enabled ? currentPin : undefined);
            if (res.ok) {
                onChanged(true);
                reset();
            } else {
                setError(res.message ?? strings.settings.incorrectPin);
            }
        } finally {
            setSaving(false);
        }
    };

    const submitTurnOff = async () => {
        setError(null);
        setSaving(true);
        try {
            const res = await disableParentalControl(currentPin);
            if (res.ok) {
                onChanged(false);
                reset();
            } else {
                setError(res.message ?? strings.settings.incorrectPin);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <SectionHeader label={strings.settings.parentalHeader} />
            <View style={[styles.section, styles.glass]}>
                <Text style={[styles.info, { color: theme.static.colorTextSecondary }]}>
                    {enabled ? strings.settings.parentalEnabledDesc : strings.settings.parentalDisabledDesc}
                </Text>

                {!editing ? (
                    <View style={styles.signOutGroup}>
                        <ActionRow
                            icon="bi-key"
                            label={enabled ? strings.settings.changePin : strings.settings.setPin}
                            tone={theme.static.colorTextPrimary}
                            onPress={() => setEditing(true)}
                        />
                        {enabled ? (
                            <ActionRow
                                icon="bi-shield-x"
                                label={strings.settings.turnOff}
                                tone={theme.static.colorError}
                                onPress={() => setEditing(true)}
                            />
                        ) : null}
                    </View>
                ) : (
                    <View style={{ marginTop: 20 }}>
                        {enabled ? (
                            <PinField
                                label={strings.settings.currentPinLabel}
                                value={currentPin}
                                active={activeField === 'current'}
                                onFocus={() => setActiveField('current')}
                            />
                        ) : null}
                        <PinField
                            label={strings.settings.newPinLabel}
                            value={newPin}
                            active={activeField === 'new'}
                            onFocus={() => setActiveField('new')}
                        />
                        <PinField
                            label={strings.settings.confirmPinLabel}
                            value={confirmPin}
                            active={activeField === 'confirm'}
                            onFocus={() => setActiveField('confirm')}
                        />

                        {error ? <Text style={[styles.pinError, { color: theme.static.colorError }]}>{error}</Text> : null}

                        <View style={{ marginTop: 16 }}>
                            <PinPad disabled={saving} onDigit={onDigit} onBackspace={onBackspace} />
                        </View>

                        <View style={styles.pinActions}>
                            <FocusableButton
                                title={strings.common.cancel}
                                onPress={reset}
                                style={{ marginRight: 12 }}
                            />
                            <FocusableButton
                                title={saving ? '…' : strings.common.save}
                                onPress={submitSave}
                                style={{ backgroundColor: theme.static.colorAccent, borderColor: theme.static.colorAccent }}
                            />
                            {enabled ? (
                                <FocusableButton
                                    title={strings.settings.turnOff}
                                    onPress={submitTurnOff}
                                    style={{ backgroundColor: theme.static.colorError, borderColor: theme.static.colorError, marginLeft: 12 }}
                                />
                            ) : null}
                        </View>
                    </View>
                )}
            </View>
        </>
    );
}

function PinField({ label, value, active, onFocus }: { label: string; value: string; active: boolean; onFocus: () => void }) {
    const { theme } = useContext(ThemeContext);
    return (
        <TouchableOpacity
            onPress={onFocus}
            style={[styles.pinField, { borderColor: active ? theme.static.colorFocusRing : theme.static.colorBorder }]}
        >
            <Text style={[styles.pinFieldLabel, { color: theme.static.colorTextSecondary }]}>{label}</Text>
            <Text style={[styles.pinFieldDots, { color: theme.static.colorTextPrimary }]}>{'•'.repeat(value.length) || '—'}</Text>
        </TouchableOpacity>
    );
}

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

function PinPad({ onDigit, onBackspace, disabled }: { onDigit: (d: string) => void; onBackspace: () => void; disabled?: boolean }) {
    return (
        <View style={styles.pinPad}>
            {PIN_KEYS.map((k, i) =>
                k === '' ? (
                    <View key={i} style={styles.pinKey} />
                ) : (
                    <PinKey key={i} label={k} disabled={disabled} onPress={() => (k === '⌫' ? onBackspace() : onDigit(k))} />
                ),
            )}
        </View>
    );
}

function PinKey({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            {...focusProps}
            style={[
                styles.pinKey,
                { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.static.colorBorder },
                focused && { backgroundColor: theme.static.colorAccent, borderColor: theme.static.colorFocusRing },
            ]}
        >
            <Text style={[styles.pinKeyText, { color: theme.static.colorTextPrimary }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// --- Parental Controls tab: restrict by real event category -----------------

function CategoryLockPanel() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const [allCategories, setAllCategories] = useState<string[] | null>(null);
    const [restricted, setRestricted] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        Promise.all([fetchAllCategoryNames(), fetchRestrictedCategories()])
            .then(([all, rest]) => {
                setAllCategories(all);
                setRestricted(new Set(rest));
            })
            .catch(() => setAllCategories([]));
    }, []);

    const toggle = async (category: string) => {
        const next = new Set(restricted);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        setRestricted(next);
        setSaving(true);
        try {
            await setRestrictedCategories(Array.from(next));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <SectionHeader label={strings.settings.categoryLockHeader} />
            <View style={[styles.section, styles.glass]}>
                <Text style={[styles.info, { color: theme.static.colorTextSecondary, marginBottom: 16 }]}>
                    {strings.settings.categoryLockDesc}
                </Text>
                {allCategories === null ? (
                    <ActivityIndicator color={theme.static.colorAccent} />
                ) : allCategories.length === 0 ? (
                    <Text style={[styles.info, { color: theme.static.colorTextSecondary }]}>{strings.settings.noCategoriesYet}</Text>
                ) : (
                    allCategories.map((cat) => (
                        <SelectRow
                            key={cat}
                            title={cat}
                            description=""
                            active={restricted.has(cat)}
                            onPress={() => !saving && toggle(cat)}
                        />
                    ))
                )}
            </View>
        </>
    );
}

// --- Language & Audio tab ----------------------------------------------------

function LanguagePanel() {
    const { theme } = useContext(ThemeContext);
    const { strings, locale, setLocale } = useTranslation();
    return (
        <>
            <SectionHeader label={strings.settings.languageHeader} />
            <View style={[styles.section, styles.glass]}>
                <Text style={[styles.info, { color: theme.static.colorTextSecondary, marginBottom: 16 }]}>
                    {strings.settings.languageDesc}
                </Text>
                {LOCALES.map((l) => (
                    <LanguageRow key={l.code} label={l.label} active={locale === l.code} onPress={() => setLocale(l.code)} />
                ))}
            </View>
        </>
    );
}

function LanguageRow({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.toggleRow, focused && { backgroundColor: 'rgba(255,255,255,0.06)' }]}
        >
            <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: theme.static.colorTextPrimary }]}>{label}</Text>
            </View>
            {active ? <i className="bi bi-check-lg" style={{ fontSize: 18, color: theme.static.colorAccent }} /> : null}
        </TouchableOpacity>
    );
}

// --- Shared small pieces -----------------------------------------------------

function SidebarTab({
    icon,
    label,
    active,
    onPress,
}: {
    icon: string;
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[
                styles.sidebarTab,
                active && { backgroundColor: 'rgba(242, 12, 143, 0.14)' },
                focused && { backgroundColor: theme.static.colorFocusRing },
            ]}
        >
            <i
                className={`bi ${icon}`}
                style={{ fontSize: 17, color: focused ? '#fff' : active ? theme.static.colorAccent : theme.static.colorTextSecondary }}
            />
            <Text
                style={[
                    styles.sidebarTabText,
                    { color: focused ? '#fff' : active ? theme.static.colorTextPrimary : theme.static.colorTextSecondary },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: string }) {
    const { theme } = useContext(ThemeContext);
    return (
        <View style={styles.stat}>
            <i className={`bi ${icon}`} style={{ fontSize: 15, color: tone ?? theme.static.colorTextSecondary }} />
            <View>
                <Text style={[styles.statLabel, { color: theme.static.colorTextSecondary }]}>{label}</Text>
                <Text style={[styles.statValue, { color: tone ?? theme.static.colorTextPrimary }]}>{value}</Text>
            </View>
        </View>
    );
}

function SectionHeader({ label }: { label: string }) {
    const { theme } = useContext(ThemeContext);
    return <Text style={[styles.sectionHeader, { color: theme.static.colorTextPrimary }]}>{label}</Text>;
}

function ActionRow({
    icon,
    label,
    tone,
    onPress,
    disabled,
    loading,
}: {
    icon: string;
    label: string;
    tone: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            {...focusProps}
            style={[
                styles.actionRow,
                focused && { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: theme.static.colorFocusRing },
            ]}
        >
            <i className={`bi ${icon}`} style={{ fontSize: 16, color: tone }} />
            <Text style={[styles.actionRowText, { color: tone }]}>{label}</Text>
            {loading ? <ActivityIndicator color={tone} style={{ marginLeft: 8 }} /> : null}
        </TouchableOpacity>
    );
}

function ToggleRow({
    icon,
    title,
    description,
    value,
    onToggle,
    loading,
}: {
    icon: string;
    title: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    loading?: boolean;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onToggle}
            disabled={loading}
            {...focusProps}
            style={[styles.toggleRow, focused && { backgroundColor: 'rgba(255,255,255,0.06)' }]}
        >
            <View style={[styles.toggleIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <i className={`bi ${icon}`} style={{ fontSize: 18, color: theme.static.colorTextPrimary }} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: theme.static.colorTextPrimary }]}>{title}</Text>
                <Text style={[styles.toggleDescription, { color: theme.static.colorTextSecondary }]}>{description}</Text>
            </View>
            {loading ? (
                <ActivityIndicator color={theme.static.colorAccent} />
            ) : (
                <View
                    style={[
                        styles.switchTrack,
                        { backgroundColor: value ? theme.static.colorAccent : 'rgba(255,255,255,0.14)' },
                        focused && { borderColor: theme.static.colorFocusRing },
                    ]}
                >
                    <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
                </View>
            )}
        </TouchableOpacity>
    );
}

/** Read-only row for a real, automatic behavior — no fake selector, just what's actually happening. */
function InfoRow({ icon, title, description, badge }: { icon: string; title: string; description: string; badge?: string }) {
    const { theme } = useContext(ThemeContext);
    return (
        <View style={styles.toggleRow}>
            <View style={[styles.toggleIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <i className={`bi ${icon}`} style={{ fontSize: 18, color: theme.static.colorTextPrimary }} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: theme.static.colorTextPrimary }]}>{title}</Text>
                {description ? <Text style={[styles.toggleDescription, { color: theme.static.colorTextSecondary }]}>{description}</Text> : null}
            </View>
            {badge ? (
                <View style={styles.infoBadge}>
                    <Text style={[styles.infoBadgeText, { color: theme.static.colorTextSecondary }]}>{badge}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    body: { flex: 1, flexDirection: 'row' },

    sidebar: {
        width: 280,
        paddingVertical: 32,
        paddingHorizontal: 20,
        borderRightWidth: 1,
        gap: 4,
    },
    sidebarHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28, paddingHorizontal: 8 },
    backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    sidebarTitle: { fontSize: 22, fontWeight: '800' },
    sidebarTab: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10 },
    sidebarTabText: { fontSize: 15, fontWeight: '600' },

    mainContent: { flex: 1 },
    mainContentInner: { padding: 48, paddingTop: 40, paddingBottom: 80 },
    glass: midnightGlass as object,

    summaryCard: {
        flexDirection: 'row',
        borderRadius: 20,
        padding: 32,
        maxWidth: 980,
        marginBottom: 40,
        gap: 32,
    },
    summaryLeft: { flex: 1 },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 24 },
    avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)' },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
    name: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    email: { fontSize: 15 },
    statRow: { flexDirection: 'row', gap: 32, flexWrap: 'wrap' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statLabel: { fontSize: 12, marginBottom: 2 },
    statValue: { fontSize: 15, fontWeight: '700' },
    lastLogin: { fontSize: 13, marginTop: 20 },
    summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.12)' },
    summaryRight: { alignItems: 'center', width: 200 },
    qrBox: { width: 144, height: 144, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 8, marginBottom: 14 },
    qrTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
    qrCaption: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

    sectionHeader: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, opacity: 0.8 },
    section: { borderRadius: 16, padding: 24, marginBottom: 32, maxWidth: 980 },
    info: { fontSize: 15, lineHeight: 21 },

    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
    toggleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    toggleTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    toggleDescription: { fontSize: 13 },
    switchTrack: { width: 48, height: 28, borderRadius: 14, padding: 3, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center' },
    switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
    switchThumbOn: { transform: [{ translateX: 20 }] },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 6 },
    infoBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
    infoBadgeText: { fontSize: 12, fontWeight: '700' },

    deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
    deviceIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    deviceLabel: { fontSize: 16, fontWeight: '700' },
    deviceMeta: { fontSize: 13, marginTop: 2 },
    signOutGroup: { marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)', gap: 4 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
    actionRowText: { fontSize: 14, fontWeight: '700' },

    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 14, padding: 20, maxWidth: 980 },
    tipText: { flex: 1, fontSize: 13, lineHeight: 19 },

    deviceOnlyNote: { fontSize: 13, maxWidth: 980 },

    lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
    lockCard: { borderRadius: 20, padding: 36, width: 380, alignItems: 'center' },
    lockTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    lockSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 18 },

    pinDots: { fontSize: 28, letterSpacing: 8, minHeight: 36, marginBottom: 8 },
    pinError: { fontSize: 13, marginBottom: 12, textAlign: 'center' },
    pinPad: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 64 + 2 * 10, gap: 10, justifyContent: 'center' },
    pinKey: { width: 64, height: 52, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    pinKeyText: { fontSize: 20, fontWeight: '700' },

    pinField: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, maxWidth: 320 },
    pinFieldLabel: { fontSize: 12, marginBottom: 4 },
    pinFieldDots: { fontSize: 18, letterSpacing: 4 },
    pinActions: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
});
