import {
  m5BaseURL,
  m5MailPort,
  m5MailURL,
  m5StripePort,
  m5StripeURL,
  m5WebPort,
} from './scripts/m5-test-urls';
import { testDatabaseUrl } from './scripts/sqlite-test';
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.m4.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!server) throw new Error('M5 requires the isolated production web server');
/** M5 production-browser suite uses the real app with isolated SQLite, KV, mail and signed Stripe events. */
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
  use: { ...base.use, baseURL: m5BaseURL, reducedMotion: 'reduce' },
  webServer: {
    ...server,
    url: `${m5BaseURL}/zh`,
    env: {
      ...server?.env,
      TEST_DATABASE_ID: '57552',
      TEST_SHADOW_PORT: '57553',
      TEST_MAIL_PORT: String(m5MailPort),
      TEST_WEB_PORT: String(m5WebPort),
      // DESIGN-GAP: SQLite files are isolated per suite and shared across test processes.
      LOCAL_DATABASE_URL: testDatabaseUrl(57552),
      AUTH_URL: m5BaseURL,
      NEXT_PUBLIC_SITE_URL: m5BaseURL,
      TEST_MAIL_URL: m5MailURL,
      TEST_STRIPE_URL: m5StripeURL,
      TEST_STRIPE_PORT: String(m5StripePort),
    },
  },
});
