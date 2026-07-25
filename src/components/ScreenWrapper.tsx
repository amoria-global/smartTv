import React, { useContext } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ThemeContext } from '../config';

type Props = {
    children: React.ReactNode;
    noPadding?: boolean;
};

// Same treatment as the login screen (blurred backdrop photo + dark scrim)
// so every page sharing this wrapper feels consistent — Navbar now renders
// as a top bar (see components/Navbar.tsx), so this stacks column-wise
// (nav on top, content below) rather than the old row layout for a left
// sidebar.
export function ScreenWrapper({ children, noPadding = false }: Props) {
    const { theme } = useContext(ThemeContext);

    return (
        <View style={[styles.root, { backgroundColor: theme.static.colorBgPrimary }]}>
            <Image source={{ uri: '/images/login.png' }} style={StyleSheet.absoluteFillObject} blurRadius={18} />
            <View style={[styles.scrim, { backgroundColor: theme.static.colorBgPrimary }]} />
            <View style={[styles.container, !noPadding && styles.padding]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, minHeight: '100vh', position: 'relative' } as object,
    scrim: { ...StyleSheet.absoluteFillObject, opacity: 0.6 } as object,
    container: {
        flex: 1,
        flexDirection: 'column',
    },
    padding: {
        padding: 48,
    },
});
