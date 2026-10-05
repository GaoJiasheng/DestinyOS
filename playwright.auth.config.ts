import { defineConfig, devices } from '@playwright/test';
import root from './playwright.config';

export default defineConfig({
  // DESIGN-GAP: Auth/readings-derived suites share the root cross-platform baseline convention as well.
  snapshotPathTemplate: root.snapshotPathTemplate,
  testDir: './apps/web/e2e',
  testMatch: 'auth.spec.ts',
  workers: 1,
  timeout: 60_000,
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
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:55432/postgres?connection_limit=1&statement_cache_size=0',
      DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55432/postgres',
      REDIS_URL: 'redis://127.0.0.1:56379',
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
      AUTH_SECRET: 'isolated-e2e-secret-never-use-in-production',
      AUTH_URL: 'http://localhost:3100',
      AUTH_TRUST_HOST: 'true',
      AUTH_GOOGLE_ID: 'test-google-id',
      AUTH_GOOGLE_SECRET: 'test-google-secret',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'DestinyOS <login@example.com>',
      TEST_MAIL_URL: 'http://127.0.0.1:58081/mail',
      ADMIN_EMAILS: 'admin@example.com',
      FIELD_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString('base64')}`,
    },
  },
});
