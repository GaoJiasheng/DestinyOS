import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  // DESIGN-GAP: Preserve paid evaluation evidence in sibling test-results directories when Playwright cleans output.
  outputDir: 'test-results/playwright',
  testIgnore: [
    // DESIGN-GAP: Workers binding checks require wrangler on port 8787 and run separately via test:cloudflare:e2e after cf:build/cf:smoke.
    'cloudflare.spec.ts',
    // DESIGN-GAP: Merged feature suites seed private data and require their dedicated isolated-service configs, just like the original auth/report suites.
    'seo-content.spec.ts',
    'journal.spec.ts',
    'export.spec.ts',
    'chat.spec.ts',
    'numerology.spec.ts',
    'rectification.spec.ts',
    'calendar.spec.ts',
    'synastry.spec.ts',
    'zhtw.spec.ts',
    'auth.spec.ts',
    'readings.spec.ts',
    'bazi-charts.spec.ts',
    'ziwei.spec.ts',
    'divination.spec.ts',
    'tarot.spec.ts',
    'astrology.spec.ts',
    'home.spec.ts',
    'daily-account.spec.ts',
    'm4.spec.ts',
    'm5-flows.spec.ts',
    'm5-admin.spec.ts',
    'm5-accessibility.spec.ts',
    // DESIGN-GAP: The polish suite seeds private reports through isolated production services, so it must run with playwright.polish.config.ts.
    'polish.spec.ts',
    'polish-new-pages.spec.ts',
    // DESIGN-GAP: Artwork budget tests require the production PWA and run through the existing polish configuration.
    'art.spec.ts',
  ],
  fullyParallel: true,
  // DESIGN-GAP: Cold dev compilation and hydration share the test budget; allow 60s without relaxing individual UI assertions.
  timeout: 60_000,
  // DESIGN-GAP: Self-hosted fonts use one baseline name across macOS developers and Ubuntu CI; keep the same pixel tolerance.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  // DESIGN-GAP: Serialize the dev-server suite so simultaneous cold route compilations do not compete with browser hydration.
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
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
    command: 'pnpm --filter @tianji/web dev',
    url: 'http://localhost:3000/zh',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
