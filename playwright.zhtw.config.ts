import { defineConfig } from '@playwright/test';
import base from './playwright.auth.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
// DESIGN-GAP: Locale/SEO acceptance uses isolated production services so dev Fast Refresh cannot change catalogs during a language transition.
export default defineConfig({
  ...base,
  testMatch: 'zhtw.spec.ts',
  use: { ...base.use, baseURL: 'http://localhost:40177', reducedMotion: 'reduce' },
  webServer: {
    ...server,
    command: 'pnpm exec tsx scripts/test-services.ts --web',
    url: 'http://localhost:40177/zh-TW',
    env: {
      ...server?.env,
      TEST_WEB_MODE: 'production',
      TEST_WEB_PORT: '40177',
      TEST_POSTGRES_PORT: '60432',
      TEST_SHADOW_PORT: '60433',
      TEST_REDIS_PORT: '60379',
      TEST_MAIL_PORT: '60082',
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:60432/postgres?connection_limit=1&statement_cache_size=0',
      DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:60432/postgres',
      REDIS_URL: 'redis://127.0.0.1:60379',
      AUTH_URL: 'http://localhost:40177',
      TEST_MAIL_URL: 'http://127.0.0.1:60082/mail',
    },
  },
});
