import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Next 16 dev blocks /_next resources for a 127.0.0.1 origin, so the page never hydrates; use localhost.
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
  use: { ...base.use, baseURL: 'http://localhost:3033' },
  webServer: {
    command: 'pnpm --filter @tianji/web dev --port 3033',
    url: 'http://localhost:3033/zh',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
