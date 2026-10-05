import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
// DESIGN-GAP: Dedicated service offsets let this suite run beside another worktree's isolated test harness.
const offset = Number(process.env.TEST_SERVICE_PORT_OFFSET ?? 0);
const baseURL = `http://localhost:${3100 + offset}`;
const databaseURL = `postgresql://postgres:postgres@127.0.0.1:${55432 + offset}/postgres?connection_limit=1&statement_cache_size=0`;
// DESIGN-GAP: Reuse the isolated PostgreSQL/Redis harness and preload a provider-protocol mock; no production auth bypass.
export default defineConfig({
  ...base,
  // DESIGN-GAP: Playwright clears its output directory; isolate chat E2E from paid evaluation evidence.
  outputDir: 'test-results/chat-e2e',
  testMatch: 'chat.spec.ts',
  use: { ...base.use, baseURL },
  timeout: 120000,
  expect: { timeout: 30000 },
  webServer: {
    ...base.webServer,
    url: `${baseURL}/zh/auth/login`,
    env: {
      ...base.webServer?.env,
      DATABASE_URL: databaseURL,
      DIRECT_DATABASE_URL: databaseURL,
      REDIS_URL: `redis://127.0.0.1:${56379 + offset}`,
      TEST_MAIL_URL: `http://127.0.0.1:${58081 + offset}/mail`,
      AUTH_URL: baseURL,
      FEATURE_LLM_CHAT: 'true',
      MINIMAX_API_KEY: 'isolated-chat-key',
      MINIMAX_BASE_URL: 'https://api.minimaxi.com/v1',
      MINIMAX_MODEL: 'MiniMax-M2.5',
      TEST_CHAT_MOCK: '1',
    },
  },
});
