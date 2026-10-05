import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// DESIGN-GAP: A dedicated port prevents screenshot runs from reusing another task's concurrent Next.js server.
export default defineConfig({
  ...base,
  testMatch: 'bazi-charts.spec.ts',
  testIgnore: [],
  timeout: 120_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: { stylePath: 'apps/web/e2e/component-screenshot.css' },
  },
  use: { ...base.use, baseURL: 'http://127.0.0.1:3033' },
  webServer: {
    command: 'pnpm --filter @tianji/web dev --port 3033',
    url: 'http://127.0.0.1:3033/zh',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
