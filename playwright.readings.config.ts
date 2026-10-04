import base from './playwright.auth.config';
import { defineConfig } from '@playwright/test';
// DESIGN-GAP: Reuse the isolated PostgreSQL/Redis/mail harness; production Auth.js remains unchanged.
export default defineConfig({
  ...base,
  testMatch: 'readings.spec.ts',
  timeout: 120_000,
  // DESIGN-GAP: Cold Next.js compilation of bilingual report routes can exceed Playwright’s 5s assertion default.
  expect: { timeout: 30_000 },
});
