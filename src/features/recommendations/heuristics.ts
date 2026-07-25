import type { TvCategory, TvVideo } from '../../api/catalog';

export type SmartRecommendations = {
    /** Title of the most recent Continue Watching item — seeds the "because you watched X" row title. Undefined if nothing's in progress. */
    seedTitle?: string;
    becauseYouWatched: TvVideo[];
    discover: TvVideo[];
    topPicks: TvVideo[];
    hasAny: boolean;
};

/**
 * Real (if simple) heuristic: seed "because you watched" from the category of
 * the customer's most recent Continue Watching item, filtered out of the
 * general Trending feed. No ML model here — just an honest content-based
 * filter over real data, not a fake "AI" label over mocks. Shared by the
 * /ai-recommendations page and the AI assistant's get_recommendations tool
 * so both surfaces agree on what "recommended" means.
 */
export function getSmartRecommendations(categories: TvCategory[]): SmartRecommendations {
    const continueWatching = categories.find((c) => c.id === 'continue-watching')?.videos ?? [];
    const trending = categories.find((c) => c.id === 'trending')?.videos ?? [];
    const topPicks = categories.find((c) => c.id === 'top-picks')?.videos ?? [];

    const seedCategory = continueWatching[0]?.category;
    const becauseYouWatched = seedCategory
        ? trending.filter((v) => v.category === seedCategory)
        : [];
    const discover = trending.filter((v) => !becauseYouWatched.some((b) => b.id === v.id));

    return {
        seedTitle: continueWatching[0]?.title,
        becauseYouWatched,
        discover,
        topPicks,
        hasAny: !!(becauseYouWatched.length || discover.length || topPicks.length),
    };
}
