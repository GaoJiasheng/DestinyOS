import { defineConfig } from '@playwright/test';
import base from './playwright.daily-account.config';
/** Calendar runs against real isolated services on desktop and 375px mobile, in zh/en. */
export default defineConfig({ ...base, testMatch: 'calendar.spec.ts' });
