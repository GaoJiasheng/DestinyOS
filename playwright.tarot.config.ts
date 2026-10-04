import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// DESIGN-GAP: An isolated port prevents this worktree from reusing another task's server; production output avoids dev compilation distorting frame-rate samples.
export default defineConfig({
  ...base,
  testMatch: 'tarot.spec.ts',
  testIgnore: [],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  // DESIGN-GAP: Trace snapshots retain debugging context; disabling trace screenshots keeps the FPS sample free from per-frame PNG capture overhead.
  use: {
    ...base.use,
    baseURL: 'http://localhost:3136',
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
  },
  webServer: {
    command: 'pnpm --filter @tianji/web start --port 3136',
    url: 'http://localhost:3136/zh',
    reuseExistingServer: false,
    timeout: 120_000,
    // DESIGN-GAP: Anonymous E2E supplies an isolated Auth.js secret so missing deployment credentials cannot produce an error-shaped session.
    env: {
      AUTH_SECRET: 'tarot-e2e-only-secret-never-use-in-production',
      AUTH_URL: 'http://localhost:3136',
      AUTH_TRUST_HOST: 'true',
    },
  },
});
