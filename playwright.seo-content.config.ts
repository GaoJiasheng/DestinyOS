import { defineConfig, devices } from '@playwright/test';
// DESIGN-GAP: Public-content acceptance runs the built server without private seed services; the app's existing unavailable-service fallbacks retain public access.
export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: 'seo-content.spec.ts',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://localhost:40191', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
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
    command: 'pnpm --filter @tianji/web exec next start -p 40191',
    url: 'http://localhost:40191/zh/learn',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { FEATURE_ADS: 'false' },
  },
});
