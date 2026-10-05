import { defineConfig } from '@playwright/test';
import base from './playwright.daily-account.config';
/** Paired readings exercise the real owner UI, Prisma encryption and production routes. */
export default defineConfig({ ...base, testMatch: 'synastry.spec.ts' });
