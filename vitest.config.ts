import { defineConfig } from 'vitest/config';

/**
 * Vitest for the TV app. Scoped to pure-logic units (src/utils, i18n shape)
 * that have no React Native / react-native-web imports, so they run in a plain
 * node environment with no RN mocking. Component/render tests would need
 * jsdom + an RN-web transform and are intentionally out of scope for this suite.
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        globals: false,
    },
});
