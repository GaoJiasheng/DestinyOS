import { testDatabaseUrl } from './scripts/sqlite-test';
import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Test the production PWA, private-cache exclusions, capability fallbacks and 3D renderer. */
export default defineConfig({
  ...base,
  testMatch: 'home.spec.ts',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  timeout: 90_000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled' },
  },
  use: { ...base.use, baseURL: 'http://localhost:38100' },
  webServer: {
    ...server,
    command: 'pnpm exec tsx scripts/test-services.ts --web',
    url: 'http://localhost:38100/zh',
    env: {
      ...server?.env,
      TEST_SERVICE_PORT_OFFSET: '2000',
      TEST_WEB_PORT: '38100',
      TEST_WEB_MODE: 'production',
      LOCAL_DATABASE_URL: testDatabaseUrl(57432),
      AUTH_URL: 'http://localhost:38100',
      TEST_MAIL_URL: 'http://127.0.0.1:60081/mail',
    },
  },
});
