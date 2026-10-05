import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  testIgnore: [
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
