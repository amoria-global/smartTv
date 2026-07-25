import React, { useContext, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext, ICON_LOGO } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { useBackHandler } from '../hooks/useBackHandler';
import { useAuth } from '../store/auth';
import { useAssistant } from '../store/assistant';
import { useTranslation } from '../i18n';
import { EventTabFilter, fetchEventsPage } from '../api/catalog';
import { LanguageSwitcher } from './LanguageSwitcher';

// Global nav destinations, in order: Home (the curated dashboard), then the
// same All/Live/Upcoming/Ended filters /events itself supports — living
// here instead of buried in a tab row inside the events page body, so
// they're reachable (and show their current-page state) from anywhere in
// the app, not just once you've already navigated to /events.
const EVENT_FILTER_TABS: { key: EventTabFilter; icon: string }[] = [
    { key: 'ALL', icon: 'bi-grid-3x3-gap-fill' },
    { key: 'LIVE', icon: 'bi-broadcast' },
    { key: 'UPCOMING', icon: 'bi-calendar3' },
    { key: 'ENDED', icon: 'bi-check-circle' },
];

export function Navbar() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const user = useAuth((s) => s.user);
    const logout = useAuth((s) => s.logout);
    const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
    // Falls back to the initials circle if the photo URL 404s/is unreachable
    // (e.g. dev profilePicture URLs point at a LAN IP) — Image renders
    // nothing on load failure otherwise, leaving an invisible gap.
    const [avatarError, setAvatarError] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);

    // Back key closes the profile dropdown instead of navigating away.
    useBackHandler(() => setProfileMenuOpen(false), profileMenuOpen);

    const handleLogout = async () => {
        setProfileMenuOpen(false);
        await logout();
        router.replace('/login');
    };

    // Real "how many live right now" count for the Live Now badge — same
    // fetch home.tsx/events.tsx already do for their own Hot Live Trends
    // pill, just also needed here since this bar is now the actual filter
    // entry point.
    const openAssistant = useAssistant((s) => s.openOverlay);
    const [liveCount, setLiveCount] = useState(0);
    useEffect(() => {
        let active = true;
        fetchEventsPage(0, 1, 'LIVE').then((res) => {
            if (active) setLiveCount(res.totalElements);
        });
        return () => {
            active = false;
        };
    }, []);

    const activeFilter: EventTabFilter | null =
        router.pathname === '/events' ? ((router.query.filter as EventTabFilter) || 'ALL') : null;

    const tabLabel = (key: EventTabFilter) =>
        key === 'ALL' ? strings.events.tabAll : key === 'LIVE' ? strings.events.tabLive : key === 'UPCOMING' ? strings.events.tabUpcoming : strings.events.tabEnded;

    return (
        <View style={[styles.bar, { backgroundColor: 'rgba(21, 21, 28, 0.55)', borderBottomColor: theme.static.colorBorder }]}>
            <View style={styles.left}>
                <View style={styles.brandRow}>
                    <Image source={ICON_LOGO} style={styles.logo} resizeMode="contain" />
                    <Text style={[styles.brandText, { color: theme.static.colorTextPrimary }]}>Connekyt</Text>
                </View>
            </View>

            <View style={styles.center}>
                <View style={[styles.navTrack, styles.glass]}>
                    <NavLink
                        label={strings.navbar.welcome}
                        isActive={router.pathname === '/home'}
                        onPress={() => router.push('/home')}
                    />
                    {EVENT_FILTER_TABS.map((tab) => (
                        <NavLink
                            key={tab.key}
                            label={tabLabel(tab.key)}
                            icon={tab.icon}
                            count={tab.key === 'LIVE' ? liveCount : undefined}
                            isActive={activeFilter === tab.key}
                            onPress={() => router.push(tab.key === 'ALL' ? '/events' : `/events?filter=${tab.key}`)}
                        />
                    ))}
                </View>
            </View>

            <View style={styles.right}>
                <LanguageSwitcher />
                <IconButton icon="bi-mic-fill" onPress={openAssistant} />
                <IconButton icon="bi-search" onPress={() => router.push('/search')} />
                <View>
                    <TouchableOpacity onPress={() => setProfileMenuOpen((v) => !v)} style={styles.avatarButton}>
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
                    </TouchableOpacity>

                    {profileMenuOpen ? (
                        <View
                            style={[
                                styles.profileMenu,
                                { backgroundColor: theme.static.colorSurface, borderColor: theme.static.colorBorder },
                            ]}
                        >
                            <ProfileMenuItem
                                icon="bi-person-circle"
                                label={strings.settings.tabAccount}
                                onPress={() => {
                                    setProfileMenuOpen(false);
                                    router.push('/settings');
                                }}
                            />
                            <ProfileMenuItem
                                icon="bi-bookmark-heart-fill"
                                label={strings.myList.title}
                                onPress={() => {
                                    setProfileMenuOpen(false);
                                    router.push('/my-list');
                                }}
                            />
                            <View style={[styles.profileMenuDivider, { backgroundColor: theme.static.colorBorder }]} />
                            <ProfileMenuItem
                                icon="bi-box-arrow-right"
                                label={strings.settings.logOut}
                                destructive
                                onPress={handleLogout}
                            />
                        </View>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function NavLink({
    label,
    icon,
    count,
    isActive,
    onPress,
}: {
    label: string;
    icon?: string;
    count?: number;
    isActive: boolean;
    onPress: () => void;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    const textColor = isActive ? '#fff' : focused ? theme.static.colorTextPrimary : theme.static.colorTextSecondary;
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[
                styles.navLink,
                isActive && { backgroundColor: theme.static.colorBrand },
                focused && !isActive && { backgroundColor: 'rgba(255,255,255,0.08)' },
            ]}
        >
            {icon ? <i className={`bi ${icon}`} style={{ fontSize: 14, color: textColor }} /> : null}
            <Text style={[styles.navLinkText, { color: textColor }]}>{label}</Text>
            {typeof count === 'number' && count > 0 ? (
                <View style={[styles.navLinkCount, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : theme.static.colorAccent }]}>
                    <Text style={styles.navLinkCountText}>{count}</Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

function IconButton({ icon, onPress }: { icon: string; onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.iconButton, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <i
                className={`bi ${icon}`}
                style={{ fontSize: 18, color: focused ? '#fff' : theme.static.colorTextPrimary }}
            />
        </TouchableOpacity>
    );
}

function ProfileMenuItem({
    icon,
    label,
    destructive,
    onPress,
}: {
    icon: string;
    label: string;
    destructive?: boolean;
    onPress: () => void;
}) {
    const { theme } = useContext(ThemeContext);
    const { focused, focusProps } = useFocusNav();
    const color = destructive ? theme.static.colorError : focused ? '#fff' : theme.static.colorTextPrimary;
    return (
        <TouchableOpacity
            onPress={onPress}
            {...focusProps}
            style={[styles.profileMenuItem, focused && { backgroundColor: theme.static.colorFocusRing }]}
        >
            <i className={`bi ${icon}`} style={{ fontSize: 15, color: focused ? '#fff' : color }} />
            <Text style={[styles.profileMenuItemText, { color: focused ? '#fff' : color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    // 3-column grid, not a flex:1/1/1 sandwich — a flex split caps the
    // center column to exactly a third of the bar regardless of its actual
    // content width, which looked fine in English but crowded the language
    // switcher once French/Kinyarwanda's longer tab labels overflowed that
    // third. `1fr auto 1fr` centers correctly (equal 1fr on both sides,
    // same guarantee flex:1/1/1 gave) while letting the center column grow
    // to whatever width its content actually needs.
    bar: {
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        // Grid doesn't add spacing between columns on its own the way the
        // old flex layout's column boundaries incidentally did — without
        // this, the center pill can grow right up against the language
        // switcher with zero gap once its content (longer French/Kinyarwanda
        // labels) gets wide enough, even though it's still "centered".
        columnGap: 24,
        alignItems: 'center',
        paddingHorizontal: 32,
        height: 72,
        borderBottomWidth: 1,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        // Without its own elevated stacking context, the language dropdown's
        // zIndex:20 (LanguageSwitcher.tsx) only orders it among its own
        // Navbar siblings — it doesn't beat raw <video> hero tiles rendered
        // in the page's ScrollView, a later DOM sibling of this whole bar.
        // Same root cause as login.tsx's topRow z-index fix: a descendant's
        // zIndex can't out-rank an unrelated sibling subtree on its own.
        position: 'relative',
        zIndex: 100,
    } as object,
    left: { flexDirection: 'row', alignItems: 'center', justifySelf: 'start' } as object,
    center: { flexDirection: 'row', justifyContent: 'center', justifySelf: 'center' } as object,
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logo: { width: 28, height: 28 },
    brandText: { fontSize: 18, fontWeight: '800' },
    // Same frosted-glass treatment as the events page's own filter-tab
    // track (HotLiveTrendsBar's styles.glass) — kept in sync deliberately so
    // both read as the same "rounded segmented control" component, not two
    // different takes on it.
    glass: {
        backgroundColor: 'rgba(21, 21, 28, 0.42)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    } as object,
    navTrack: { flexDirection: 'row', borderRadius: 999, padding: 6, gap: 4 },
    navLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
    navLinkText: { fontSize: 15, fontWeight: '700' },
    navLinkCount: { borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    navLinkCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    // Tighter than before (was gap:16, 40px icons) — the more room this
    // cluster gives up, the more headroom the center nav pill has before
    // French/Kinyarwanda's longer labels start crowding it again.
    right: { flexDirection: 'row', alignItems: 'center', justifySelf: 'end', gap: 10 } as object,
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarButton: {},
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    // Same dropdown-under-trigger pattern as LanguageSwitcher.tsx's own
    // langMenu (position:absolute, right-aligned, zIndex above page
    // content) — kept visually consistent since both live in this same bar.
    profileMenu: {
        position: 'absolute',
        top: 44,
        right: 0,
        minWidth: 200,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 6,
        zIndex: 20,
    } as object,
    profileMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
    profileMenuItemText: { fontSize: 14, fontWeight: '600' },
    profileMenuDivider: { height: 1, marginVertical: 6, marginHorizontal: 14 },
});
