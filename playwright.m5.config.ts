import { defineConfig, devices } from '@playwright/test';
import base from './playwright.m4.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!server) throw new Error('M5 requires the isolated production web server');
/** M5 production-browser suite uses the real app with isolated database, Redis, mail and signed Stripe events. */
export default defineConfig({
  ...base,
  testMatch: ['m5-flows.spec.ts', 'm5-admin.spec.ts', 'm5-accessibility.spec.ts'],
  timeout: 180000,
  expect: {
    timeout: 30000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled' },
  },
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  workers: 1,
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        viewport: { width: 375, height: 812 },
        reducedMotion: 'reduce',
      },
    },
  ],
  use: { ...base.use, baseURL: 'http://localhost:3230', reducedMotion: 'reduce' },
  webServer: {
    ...server,
    url: 'http://localhost:3230/zh',
    env: {
      ...server?.env,
      TEST_POSTGRES_PORT: '57552',
      TEST_SHADOW_PORT: '57553',
      TEST_REDIS_PORT: '58499',
      TEST_MAIL_PORT: '60201',
      TEST_WEB_PORT: '3230',
      // DESIGN-GAP: PGlite multiplexes one PostgreSQL session; disable retained prepared statements across browser-test clients.
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:57552/postgres?connection_limit=1&statement_cache_size=0&pgbouncer=true',
      DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:57552/postgres',
      REDIS_URL: 'redis://127.0.0.1:58499',
      AUTH_URL: 'http://localhost:3230',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3230',
      TEST_MAIL_URL: 'http://127.0.0.1:60201/mail',
      TEST_STRIPE_URL: 'http://127.0.0.1:60302',
      TEST_STRIPE_PORT: '60302',
    },
  },
});
