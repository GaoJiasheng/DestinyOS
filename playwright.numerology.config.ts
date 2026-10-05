import { defineConfig } from '@playwright/test';
import base from './playwright.astrology.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Run the new bilingual system flow against an isolated production server and database. */
// DESIGN-GAP: The full chain runs the chat dev server immediately before this production suite; its package command restores the production build before booting Next start.
export default defineConfig({
  ...base,
  testMatch: 'numerology.spec.ts',
  use: { ...base.use, baseURL: 'http://localhost:39100' },
  webServer: {
    ...server,
    command: 'pnpm exec tsx scripts/test-services.ts --web',
    url: 'http://localhost:39100/zh/auth/login',
    env: {
      ...server?.env,
      TEST_POSTGRES_PORT: '59432',
      TEST_SHADOW_PORT: '59433',
      TEST_REDIS_PORT: '59379',
      TEST_MAIL_PORT: '59082',
      TEST_WEB_PORT: '39100',
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:59432/postgres?connection_limit=1&statement_cache_size=0',
      DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:59432/postgres',
      REDIS_URL: 'redis://127.0.0.1:59379',
      AUTH_URL: 'http://localhost:39100',
      TEST_MAIL_URL: 'http://127.0.0.1:59082/mail',
    },
  },
});
