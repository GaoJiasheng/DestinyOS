import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'packages/**/test/**/*.test.ts',
      'scripts/**/*.test.ts',
      'apps/web/test/**/*.test.ts',
    ],
    environment: 'node',
    // DESIGN-GAP: Four workers and a 15s timeout accommodate real Chromium plus exhaustive calendar fixtures under coverage without changing assertions or coverage thresholds.
    maxWorkers: 4,
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: [
        'packages/engine/src/**/*.ts',
        'packages/shared/src/**/*.ts',
        'apps/web/lib/crypto.ts',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
