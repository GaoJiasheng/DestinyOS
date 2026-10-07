import { testDatabaseUrl } from './scripts/sqlite-test';
import { defineConfig, devices } from '@playwright/test';
import root from './playwright.config';
// DESIGN-GAP: e2e/package.json makes browser tests ESM so shared SQLite helpers follow the root module convention without changing the app runtime.

export default defineConfig({
  // DESIGN-GAP: Auth/readings-derived suites share the root cross-platform baseline convention as well.
  snapshotPathTemplate: root.snapshotPathTemplate,
  outputDir: root.outputDir,
  testDir: './apps/web/e2e',
  testMatch: 'auth.spec.ts',
  workers: 1,
  // DESIGN-GAP: Cold Auth.js route compilation shares the browser test budget; database/token assertions are unchanged.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    command: 'pnpm exec tsx scripts/test-services.ts --web',
    url: 'http://localhost:3100/zh/auth/login',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      LOCAL_DATABASE_URL: testDatabaseUrl(55432),

      AUTH_SECRET: 'isolated-e2e-secret-never-use-in-production',
      AUTH_URL: 'http://localhost:3100',
      AUTH_TRUST_HOST: 'true',
      AUTH_GOOGLE_ID: 'test-google-id',
      AUTH_GOOGLE_SECRET: 'test-google-secret',
      EMAIL_FROM: 'noreply@mail.gavin.pub',
      EMAIL_FROM_NAME: '天机 DestinyOS',
      TEST_MAIL_URL: 'http://127.0.0.1:58081/mail',
      ADMIN_EMAILS: 'admin@example.com',
      FIELD_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString('base64')}`,
    },
  },
});
