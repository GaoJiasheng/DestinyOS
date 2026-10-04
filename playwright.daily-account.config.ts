import { defineConfig } from '@playwright/test';
import base from './playwright.auth.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Real production UI and actions against isolated PostgreSQL, Redis and mail endpoints. */
export default defineConfig({
  ...base,
  testMatch: 'daily-account.spec.ts',
  timeout: 120000,
  expect: { timeout: 30000 },
  use: { ...base.use, baseURL: 'http://localhost:3210' },
  webServer: {
    ...server,
    command: 'pnpm exec tsx scripts/test-services.ts --web',
    url: 'http://localhost:3210/zh',
    env: {
      ...server?.env,
      TEST_SERVICE_PORT_OFFSET: '2100',
      TEST_POSTGRES_PORT: '57532',
      TEST_SHADOW_PORT: '57533',
      TEST_REDIS_PORT: '58479',
      TEST_MAIL_PORT: '60181',
      TEST_WEB_PORT: '3210',
      TEST_WEB_MODE: 'production',
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:57532/postgres?connection_limit=1&statement_cache_size=0',
      DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:57532/postgres',
      REDIS_URL: 'redis://127.0.0.1:58479',
      AUTH_URL: 'http://localhost:3210',
      TEST_MAIL_URL: 'http://127.0.0.1:60181/mail',
      CRON_SECRET: 'isolated-cron-secret',
    },
  },
});
