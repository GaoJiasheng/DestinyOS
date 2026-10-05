import { defineConfig } from '@playwright/test';
import base from './playwright.daily-account.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!server) throw new Error('M4 requires the isolated production web server');
/** Real product UI/actions with isolated signed test-mode Stripe webhook delivery. */
export default defineConfig({
  ...base,
  testMatch: 'm4.spec.ts',
  workers: 1,
  use: { ...base.use, baseURL: 'http://localhost:3220' },
  webServer: {
    ...server,
    url: 'http://localhost:3220/zh',
    env: {
      ...server?.env,
      TEST_POSTGRES_PORT: '57542',
      TEST_SHADOW_PORT: '57543',
      TEST_REDIS_PORT: '58489',
      TEST_MAIL_PORT: '60191',
      TEST_WEB_PORT: '3220',
      DATABASE_URL:
        'postgresql://postgres:postgres@127.0.0.1:57542/postgres?connection_limit=1&statement_cache_size=0',
      DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:57542/postgres',
      REDIS_URL: 'redis://127.0.0.1:58489',
      AUTH_URL: 'http://localhost:3220',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3220',
      TEST_MAIL_URL: 'http://127.0.0.1:60191/mail',
      STRIPE_SECRET_KEY: 'sk_test_m4',
      STRIPE_WEBHOOK_SECRET: 'whsec_m4',
      STRIPE_PRICE_MONTHLY: 'price_monthly_test',
      STRIPE_PRICE_YEARLY: 'price_yearly_test',
      STRIPE_TAX_ENABLED: 'true',
      TEST_STRIPE_MOCK: '1',
      TEST_STRIPE_URL: 'http://127.0.0.1:60282',
      TEST_STRIPE_PORT: '60282',
    },
  },
});
