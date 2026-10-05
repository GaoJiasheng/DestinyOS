import { defineConfig } from '@playwright/test';
import base from './playwright.m5.config';
/** Seven-system bilingual production export acceptance on the isolated database/Redis/mail stack. */
export default defineConfig({
  ...base,
  testMatch: 'export.spec.ts',
  timeout: 300000,
  projects: [
    { name: 'export', use: { viewport: { width: 1000, height: 1200 }, reducedMotion: 'reduce' } },
  ],
  use: { ...base.use, baseURL: 'http://localhost:3230' },
});
