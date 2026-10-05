import base from './playwright.ziwei.config';
import { defineConfig } from '@playwright/test';
// DESIGN-GAP: Reuse the isolated production report harness; this flow has no external services or screenshot baselines.
export default defineConfig({ ...base, testMatch: 'rectification.spec.ts' });
