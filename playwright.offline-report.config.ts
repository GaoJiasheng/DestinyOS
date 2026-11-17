import { testDatabaseUrl } from './scripts/sqlite-test';
import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
// The stream-delay preload only touches requests that opt in with a header; it lets the hydration
// test hold a Suspense boundary open the way a slow production response does.
const streamDelay = pathToFileURL(
  resolve(import.meta.dirname, 'scripts/test-stream-delay.mjs'),
).href;
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
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${streamDelay}`.trim(),
    },
  },
});
