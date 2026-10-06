import { defineConfig } from '@playwright/test';
import base from './playwright.daily-account.config';
import { testDatabaseUrl } from './scripts/sqlite-test';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Default-disabled payment acceptance against the real production pages and actions. */
export default defineConfig({
  ...base,
  testMatch: 'web-nopay.spec.ts',
  outputDir: 'test-results/web-nopay',
  workers: 1,
  use: { ...base.use, baseURL: 'http://localhost:3241' },
  webServer: {
    ...server,
    url: 'http://localhost:3241/zh',
    env: {
      ...server?.env,
      TEST_WEB_PORT: '3241',
      TEST_MAIL_PORT: '60211',
      LOCAL_DATABASE_URL: testDatabaseUrl(57546),
      AUTH_URL: 'http://localhost:3241',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3241',
      TEST_MAIL_URL: 'http://127.0.0.1:60211/mail',
      FEATURE_WEB_PAYMENTS: 'false',
      STRIPE_SECRET_KEY: '',
      STRIPE_PRICE_MONTHLY: '',
      STRIPE_PRICE_LIFETIME: '',
      REVENUECAT_SECRET_KEY: '',
      CF_ANALYTICS_TOKEN: '',
    },
  },
});
