import { testDatabaseUrl } from './scripts/sqlite-test';
import base from './playwright.readings.config';
import { defineConfig } from '@playwright/test';
const harness = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
// DESIGN-GAP: Reuse the isolated local database/mail harness for the Zi Wei report flow; screenshots allow the documented 0.5% pixel tolerance.
export default defineConfig({
  ...base,
  testMatch: 'ziwei.spec.ts',
  // DESIGN-GAP: Bundled fonts share a baseline path across developer macOS and Ubuntu CI.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  expect: {
    ...base.expect,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
      stylePath: new URL('./apps/web/e2e/component-screenshot.css', import.meta.url).pathname,
    },
  },
  use: { ...base.use, baseURL: 'http://localhost:3134', reducedMotion: 'reduce' },
  webServer: {
    ...harness,
    command: 'pnpm exec tsx scripts/test-services.ts --web --production',
    url: 'http://localhost:3134/zh/auth/login',
    reuseExistingServer: false,
    env: {
      ...harness?.env,
      TEST_SERVICE_PORT_OFFSET: '34',
      LOCAL_DATABASE_URL: testDatabaseUrl(55466),
      AUTH_URL: 'http://localhost:3134',
      TEST_MAIL_URL: 'http://127.0.0.1:58115/mail',
    },
  },
});
