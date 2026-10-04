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
  ],
  fullyParallel: true,
  // DESIGN-GAP: Two browser workers keep screenshots and cold Next.js compilation within the existing timeout.
  workers: 2,
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
