import { testDatabaseUrl } from './scripts/sqlite-test';
import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
// DESIGN-GAP: Chat defaults to a separate service range from auth; callers can still override the offset for parallel worktrees.
const offset = Number(process.env.TEST_SERVICE_PORT_OFFSET ?? 250);
const baseURL = `http://localhost:${3100 + offset}`;
const databaseURL = testDatabaseUrl(55432 + offset);
// DESIGN-GAP: Reuse the isolated SQLite/KV harness and preload a provider-protocol mock; no production auth bypass.
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
      TEST_SERVICE_PORT_OFFSET: String(offset),
      LOCAL_DATABASE_URL: databaseURL,

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
