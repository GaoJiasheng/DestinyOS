import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@': new URL('./apps/web', import.meta.url).pathname } },
  esbuild: { jsx: 'automatic' },
  test: {
    include: [
      'packages/**/test/**/*.test.ts',
      'scripts/**/*.test.ts',
      'apps/web/test/**/*.test.ts',
      'apps/web/test/**/*.test.tsx',
    ],
    environment: 'node',
    // DESIGN-GAP: One worker prevents full-corpus validation and Chromium from starving each other on shared development hosts; assertions and coverage thresholds are unchanged.
    maxWorkers: 1,
    // DESIGN-GAP: Whole-corpus loading now exceeds 15s under coverage; 30s matches the existing corpus hook budget without weakening assertions.
    testTimeout: 30_000,
    // DESIGN-GAP: The merged bilingual corpus needs up to 30s for hook-time schema and duplicate scans under coverage.
    hookTimeout: 30_000,
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
