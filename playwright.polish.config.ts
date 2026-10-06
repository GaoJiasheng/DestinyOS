import { defineConfig, devices } from '@playwright/test';
import base from './playwright.m5.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!server) throw new Error('Polish requires the isolated production web server');
// DESIGN-GAP: Polish has separate HTTP/mail/Stripe endpoints so M5 can run concurrently in another worktree; fixture SQLite files already live within each checkout.
const origin = 'http://localhost:3237';
const mail = 'http://127.0.0.1:60207/mail';
process.env.TEST_MAIL_URL = mail;
/** Reproducible launch polish on the full production app and isolated SQLite/KV/mail services. */
export default defineConfig({
  ...base,
  testMatch: ['polish.spec.ts', 'polish-new-pages.spec.ts', 'tarot.spec.ts', 'art.spec.ts'],
  use: { ...base.use, baseURL: origin },
  webServer: {
    ...server,
    url: `${origin}/zh`,
    env: {
      ...server?.env,
      TEST_WEB_PORT: '3237',
      AUTH_URL: origin,
      NEXT_PUBLIC_SITE_URL: origin,
      TEST_MAIL_PORT: '60207',
      TEST_MAIL_URL: mail,
      TEST_STRIPE_PORT: '60327',
      TEST_STRIPE_URL: 'http://127.0.0.1:60327',
      // DESIGN-GAP: Fake numeric ad IDs exercise reserved containers; browser tests block all external ad delivery.
      NEXT_PUBLIC_ADSENSE_CLIENT: 'ca-pub-0000000000000000',
      NEXT_PUBLIC_ADSENSE_SLOT_HOME: '1000000001',
      NEXT_PUBLIC_ADSENSE_SLOT_REPORT_TOP: '1000000002',
      NEXT_PUBLIC_ADSENSE_SLOT_REPORT_BOTTOM: '1000000003',
      NEXT_PUBLIC_ADSENSE_SLOT_TODAY: '1000000004',
      NEXT_PUBLIC_ADSENSE_SLOT_LEARN: '1000000005',
      FEATURE_ADS: 'true',
      FEATURE_LLM_CHAT: 'true',
      MINIMAX_API_KEY: 'isolated-chat-key',
      MINIMAX_MODEL: 'MiniMax-M2.5',
      MINIMAX_BASE_URL: 'https://api.minimaxi.com/v1',
      TEST_CHAT_MOCK: '1',
    },
  },
  // DESIGN-GAP: Keep runner traces outside the requested evidence folder so reruns preserve content audits and screenshots.
  outputDir: 'test-results/polish-runner',
  timeout: 240000,
  projects: [
    {
      name: '375',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        viewport: { width: 375, height: 812 },
        reducedMotion: 'reduce',
      },
    },
    {
      name: '1280',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
      },
    },
  ],
});
