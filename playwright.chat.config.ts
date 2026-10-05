import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
// DESIGN-GAP: Reuse the isolated PostgreSQL/Redis harness and preload a provider-protocol mock; no production auth bypass.
export default defineConfig({
  ...base,
  testMatch: 'chat.spec.ts',
  timeout: 120000,
  expect: { timeout: 30000 },
  webServer: {
    ...base.webServer,
    env: {
      ...base.webServer?.env,
      FEATURE_LLM_CHAT: 'true',
      MINIMAX_API_KEY: 'isolated-chat-key',
      MINIMAX_BASE_URL: 'https://api.minimaxi.com/v1',
      MINIMAX_MODEL: 'MiniMax-M2.5',
      TEST_CHAT_MOCK: '1',
    },
  },
});
