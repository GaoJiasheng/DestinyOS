import { defineConfig } from '@playwright/test';
// DESIGN-GAP: Wrangler must already be running; cloud service credentials are isolated in .dev.vars.
export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: 'cloudflare.spec.ts',
  workers: 1,
  timeout: 120000,
  expect: { timeout: 30000 },
  use: {
    baseURL: 'http://localhost:8787',
    viewport: { width: 1000, height: 900 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
});
