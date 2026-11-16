import { testDatabaseUrl } from './scripts/sqlite-test';
import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Device reports reopening offline need the production service worker, so this suite runs on `next start`. */
export default defineConfig({
  ...base,
  testMatch: 'offline-report.spec.ts',
  timeout: 150_000,
  expect: { timeout: 30_000 },
  use: { ...base.use, baseURL: 'http://localhost:38300' },
  webServer: {
    ...server,
    command: 'pnpm exec tsx scripts/test-services.ts --web',
    url: 'http://localhost:38300/zh',
    env: {
      ...server?.env,
      TEST_WEB_PORT: '38300',
      TEST_WEB_MODE: 'production',
      TEST_DATABASE_ID: '57632',
      TEST_SHADOW_PORT: '57633',
      TEST_MAIL_PORT: '60281',
      LOCAL_DATABASE_URL: testDatabaseUrl(57632),
      AUTH_URL: 'http://localhost:38300',
      TEST_MAIL_URL: 'http://127.0.0.1:60281/mail',
    },
  },
});
