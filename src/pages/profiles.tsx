import React, { useContext, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { sceneBackground } from '../components/glass/glassStyle';
import { useRouter } from 'next/router';
import { ThemeContext } from '../config';
import { useFocusNav } from '../hooks/useFocusNav';
import { useAuth } from '../store/auth';
import { useTranslation } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// Connekyt accounts don't have sub-profiles (unlike Netflix), so the "+ Add
// Profile" tile is decorative — it completes the familiar Netflix-style
// picker feel, but presses just show an honest "not available yet" note
// instead of pretending to create a profile.
export default function ProfilesScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();
    const user = useAuth((s) => s.user);
    const { focused, focusProps } = useFocusNav();
    const [addNote, setAddNote] = useState(false);
    // Falls back to the initials circle if the photo URL fails to load
    // (e.g. dev profilePicture URLs point at a LAN IP) — Image renders
    // nothing on load failure otherwise, leaving an invisible gap (same bug
    // already fixed in components/Navbar.tsx's avatar).
    const [avatarError, setAvatarError] = useState(false);

    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Your account';
    // No bare '?' glyph when we don't know who's signed in yet — a person
    // icon (matches the generic host-avatar glyph used elsewhere, e.g.
    // FocusableCard) reads as an intentional "anonymous account" state
    // rather than a placeholder that never got filled in.
    const initial = (user?.firstName?.[0] ?? user?.email?.[0])?.toUpperCase();

    return (
        <View style={[styles.root, { backgroundColor: theme.static.colorBgPrimary }]}>
            <Image source={{ uri: '/images/login.png' }} style={StyleSheet.absoluteFillObject} blurRadius={18} />
            <View style={[styles.scrim, { backgroundColor: theme.static.colorBgPrimary }]} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, sceneBackground('transparent')]} />

            <View style={styles.topRight}>
                <LanguageSwitcher />
            </View>

            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{strings.profiles.whosWatching}</Text>
                <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary }]}>
                    {strings.profiles.subtitle}
                </Text>

                <View style={styles.row}>
                    <TouchableOpacity
                        onPress={() => router.replace('/home')}
                        hasTVPreferredFocus
                        {...focusProps}
                        style={styles.profileCard}
                    >
                        {user?.profilePicture && !avatarError ? (
                            <Image
                                source={{ uri: user.profilePicture }}
                                style={[styles.avatar, { borderColor: focused ? theme.static.colorFocusRing : 'transparent' }]}
                                onError={() => setAvatarError(true)}
                            />
                        ) : (
                            <View
                                style={[
                                    styles.avatar,
                                    styles.avatarFallback,
                                    { backgroundColor: theme.static.colorBrand, borderColor: focused ? theme.static.colorFocusRing : 'transparent' },
                                ]}
                            >
                                {initial ? (
                                    <Text style={styles.avatarText}>{initial}</Text>
                                ) : (
                                    <i className="bi bi-person-fill" style={{ fontSize: 56, color: '#fff' }} />
                                )}
                            </View>
                        )}
                        <Text
                            style={[
                                styles.name,
                                { color: focused ? theme.static.colorTextPrimary : theme.static.colorTextSecondary },
                            ]}
                        >
                            {name}
                        </Text>
                    </TouchableOpacity>

                    <AddProfileTile onPress={() => setAddNote(true)} />
                </View>

                {addNote ? (
                    <Text style={[styles.addNote, { color: theme.static.colorTextSecondary }]}>
                        {strings.profiles.addNote}
                    </Text>
                ) : null}

                <TouchableOpacity onPress={() => router.push('/settings')} style={styles.manageLink}>
                    {/* No "brand purple" actually exists — connekt-mobile's and
                        salo-run's real theme files define the whole brand
                        palette as just navy + this pink. Using the accent
                        color here matches every other interactive element in
                        the app (Sign In button, focus rings, Shift key). */}
                    <Text style={[styles.manageLinkText, { color: theme.static.colorPrimaryLight }]}>
                        {strings.profiles.manageProfiles}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function AddProfileTile({ onPress }: { onPress: () => void }) {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const { focused, focusProps } = useFocusNav();
    return (
        <TouchableOpacity onPress={onPress} {...focusProps} style={styles.profileCard}>
            <View
                style={[
                    styles.avatar,
                    styles.addAvatar,
                    { borderColor: focused ? theme.static.colorFocusRing : theme.static.colorBorder },
                ]}
            >
                <Text style={[styles.addPlus, { color: focused ? theme.static.colorFocusRing : theme.static.colorTextSecondary }]}>
                    +
                </Text>
            </View>
            <Text style={[styles.name, { color: focused ? theme.static.colorTextPrimary : theme.static.colorTextSecondary }]}>
                {strings.profiles.addProfile}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, position: 'relative' },
    scrim: { ...StyleSheet.absoluteFillObject, opacity: 0.6 } as object,
    topRight: { position: 'absolute', top: 32, right: 32, zIndex: 10 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 48,
    },
    row: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
    profileCard: {
        alignItems: 'center',
    },
    avatar: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 4,
        marginBottom: 16,
    },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 48, fontWeight: '800' },
    addAvatar: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.06)' },
    addPlus: { fontSize: 56, fontWeight: '300' },
    name: {
        fontSize: 20,
        fontWeight: '600',
    },
    addNote: { marginTop: 32, fontSize: 14 },
    manageLink: { marginTop: 40 },
    manageLinkText: { fontSize: 14, fontWeight: '600' },
});
