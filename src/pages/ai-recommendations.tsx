import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'next/router';
import { ThemeContext } from '../config';
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
                    <ActivityIndicator size="large" color="#F20C8F" />
                </View>
            </ScreenWrapper>
        );
    }

    const { seedTitle, becauseYouWatched, discover, topPicks, hasAny } = getSmartRecommendations(categories);

    return (
        <ScreenWrapper noPadding>
            <Navbar />
            <ScrollView style={styles.mainContent}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.static.colorBrand }]}>{strings.aiRecommendations.title}</Text>
                    <Text style={[styles.subtitle, { color: theme.static.colorTextSecondary }]}>
                        {strings.aiRecommendations.subtitle}
                    </Text>
                </View>

                {!hasAny ? (
                    <Text style={[styles.empty, { color: theme.static.colorTextSecondary }]}>
                        {strings.aiRecommendations.empty}
                    </Text>
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
        paddingHorizontal: 48,
        marginBottom: 32,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
    },
    empty: { paddingHorizontal: 48, fontSize: 16 },
});
