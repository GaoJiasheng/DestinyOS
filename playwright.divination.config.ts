import { testDatabaseUrl } from './scripts/sqlite-test';
import base from './playwright.readings.config';
import { defineConfig } from '@playwright/test';
// DESIGN-GAP: Dedicated ports keep T-35's real-action E2E harness independent of other worktrees.
export default defineConfig({
  ...base,
  testMatch: 'divination.spec.ts',
  use: { ...base.use, baseURL: 'http://localhost:3135' },
  webServer: {
    command: 'pnpm exec tsx scripts/test-services.ts --web --production',
    url: 'http://localhost:3135/zh/auth/login',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...(base.webServer && !Array.isArray(base.webServer) ? base.webServer.env : {}),
      LOCAL_DATABASE_URL: testDatabaseUrl(55442),
      AUTH_URL: 'http://localhost:3135',
      TEST_MAIL_URL: 'http://127.0.0.1:58091/mail',
      TEST_DATABASE_ID: '55442',
      TEST_SHADOW_PORT: '55443',
      TEST_MAIL_PORT: '58091',
      TEST_WEB_PORT: '3135',
    },
  },
});
