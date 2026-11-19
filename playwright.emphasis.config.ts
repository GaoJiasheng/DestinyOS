import { testDatabaseUrl } from './scripts/sqlite-test';
import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Zi Wei chart emphasis pilot: the only suite that runs with FEATURE_EMPHASIS on (production `next start`). */
export default defineConfig({
  ...base,
  testMatch: 'emphasis.spec.ts',
  timeout: 150_000,
  expect: { timeout: 30_000 },
  use: { ...base.use, baseURL: 'http://localhost:38400', reducedMotion: 'reduce' },
  webServer: {
    ...server,
    command: 'pnpm exec tsx scripts/test-services.ts --web',
    url: 'http://localhost:38400/zh/auth/login',
    reuseExistingServer: false,
    env: {
      ...server?.env,
      FEATURE_EMPHASIS: 'true',
      TEST_WEB_PORT: '38400',
      TEST_WEB_MODE: 'production',
      TEST_MAIL_PORT: '60381',
      LOCAL_DATABASE_URL: testDatabaseUrl(57732),
      AUTH_URL: 'http://localhost:38400',
      TEST_MAIL_URL: 'http://127.0.0.1:60381/mail',
    },
  },
});
