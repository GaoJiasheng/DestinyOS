import { defineConfig, devices } from '@playwright/test';
import base from './playwright.m5.config';
const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!server) throw new Error('Polish requires the isolated production web server');
/** Reproducible launch polish on the full production app and isolated PostgreSQL/Redis/mail services. */
export default defineConfig({
  ...base,
  testMatch: ['polish.spec.ts', 'tarot.spec.ts'],
  webServer: {
    ...server,
    env: {
      ...server?.env,
      // DESIGN-GAP: Fake numeric ad IDs exercise reserved containers; browser tests block all external ad delivery.
      NEXT_PUBLIC_ADSENSE_CLIENT: 'ca-pub-0000000000000000',
      NEXT_PUBLIC_ADSENSE_SLOT_HOME: '1000000001',
      NEXT_PUBLIC_ADSENSE_SLOT_REPORT_TOP: '1000000002',
      NEXT_PUBLIC_ADSENSE_SLOT_REPORT_BOTTOM: '1000000003',
      NEXT_PUBLIC_ADSENSE_SLOT_TODAY: '1000000004',
      NEXT_PUBLIC_ADSENSE_SLOT_LEARN: '1000000005',
      FEATURE_ADS: 'true',
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
