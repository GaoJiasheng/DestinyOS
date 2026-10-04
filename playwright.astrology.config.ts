import base from './playwright.readings.config';
import { defineConfig } from '@playwright/test';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Real form/report flows use the existing isolated database, cache and auth harness. */
export default defineConfig({
  ...base,
  testMatch: 'astrology.spec.ts',
  // DESIGN-GAP: One flow includes cold report routes, auth, import and saved-chart recalculation.
  timeout: 240_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
      stylePath: 'apps/web/e2e/astrology-screenshot.css',
    },
  },
  use: { ...base.use, baseURL: 'http://localhost:37100', reducedMotion: 'reduce' },
  // DESIGN-GAP: Dedicated ports prevent parallel worktrees from sharing databases or browser servers.
  webServer: {
    ...server,
    // DESIGN-GAP: Validate real production bundles instead of recompiling development chunks between locales.
    command: 'pnpm build && pnpm exec tsx scripts/test-services.ts --web',
    timeout: 240_000,
    url: 'http://localhost:37100/zh/auth/login',
    reuseExistingServer: false,
    env: {
      ...server?.env,
      TEST_POSTGRES_PORT: '57432',
      TEST_SHADOW_PORT: '57433',
      TEST_REDIS_PORT: '57379',
      TEST_MAIL_PORT: '59081',
      TEST_WEB_PORT: '37100',
      TEST_WEB_MODE: 'production',
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:57432/postgres?connection_limit=1&statement_cache_size=0',
      DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:57432/postgres',
      REDIS_URL: 'redis://127.0.0.1:57379',
      AUTH_URL: 'http://localhost:37100',
      TEST_MAIL_URL: 'http://127.0.0.1:59081/mail',
    },
  },
});
