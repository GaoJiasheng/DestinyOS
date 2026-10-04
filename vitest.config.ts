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
    // DESIGN-GAP: A single coverage worker bounds merged-corpus audit memory and CPU contention across concurrent worktrees, retaining all assertions and timeouts.
    maxWorkers: 1,
    testTimeout: 30_000,
    // DESIGN-GAP: The merged bilingual corpus needs up to 60s for hook-time schema and duplicate scans under coverage.
    hookTimeout: 60_000,
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
