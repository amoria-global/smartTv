import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext, palette } from '../config';
import { GlassPanel } from '../components/glass/GlassPanel';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Navbar } from '../components/Navbar';
import { Row } from '../components/Row';
import { fetchCategories, TvCategory, TvVideo } from '../api/catalog';
import { getSmartRecommendations } from '../features/recommendations/heuristics';
import { useTranslation } from '../i18n';

function toRowItems(videos: TvVideo[]) {
    return videos.map((v) => ({ id: v.id, title: v.title, subtitle: v.subtitle, image: v.imageUrl }));
}

export default function AIRecommendationsScreen() {
    const { theme } = useContext(ThemeContext);
    const { strings } = useTranslation();
    const router = useRouter();

    const [categories, setCategories] = useState<TvCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCategories()
            .then((data) => {
                setCategories(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch categories', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <ScreenWrapper noPadding>
                <Navbar />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={palette.accent} />
                </View>
            </ScreenWrapper>
        );
    }

    const { seedTitle, becauseYouWatched, discover, topPicks, hasAny } = getSmartRecommendations(categories);

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <ScrollView style={styles.mainContent}>
                <GlassPanel raised style={styles.header}>
                    <View style={styles.eyebrow}>
                        <i className="bi bi-stars" style={{ fontSize: 16, color: theme.static.colorAccentLight }} />
                        <Text style={[styles.title, { color: theme.static.colorTextPrimary }]}>{strings.aiRecommendations.title}</Text>
                    </View>
                    <Text style={[styles.subtitle, { color: theme.static.colorTextSoft }]}>
                        {strings.aiRecommendations.subtitle}
                    </Text>
                </GlassPanel>

                {!hasAny ? (
                    <GlassPanel style={styles.empty}>
                        <Text style={{ color: theme.static.colorTextSecondary, fontSize: 16 }}>{strings.aiRecommendations.empty}</Text>
                    </GlassPanel>
                ) : null}

                {becauseYouWatched.length ? (
                    <Row
                        title={`${strings.aiRecommendations.becauseYouWatchedPrefix} "${seedTitle}"`}
                        items={toRowItems(becauseYouWatched)}
                        onSelect={(item) => router.push(`/detail?id=${item.id}`)}
                        rowFocusIndex={0}
                    />
                ) : null}

                {discover.length ? (
                    <Row
                        title={strings.aiRecommendations.discoverMore}
                        items={toRowItems(discover)}
                        onSelect={(item) => router.push(`/detail?id=${item.id}`)}
                        rowFocusIndex={becauseYouWatched.length ? undefined : 0}
                    />
                ) : null}

                {topPicks.length ? (
                    <Row
                        title={strings.aiRecommendations.photographersYouMightLike}
                        items={toRowItems(topPicks)}
                        onSelect={(item) => router.push(`/detail?id=${item.id}`)}
                    />
                ) : null}
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    mainContent: {
        flex: 1,
        paddingTop: 48,
    },
    header: {
        marginHorizontal: 48,
        marginBottom: 32,
        alignSelf: 'flex-start',
    },
    eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 18,
    },
    empty: { marginHorizontal: 48, alignSelf: 'flex-start' },
});
