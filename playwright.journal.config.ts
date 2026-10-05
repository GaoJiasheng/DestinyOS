import { defineConfig } from '@playwright/test';
import base from './playwright.daily-account.config';
/** One journal lifecycle flow per locale/viewport against the real isolated data services. */
export default defineConfig({ ...base, testMatch: 'journal.spec.ts' });
