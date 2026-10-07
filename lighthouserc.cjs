/* global module, process */
// DESIGN-GAP: Lighthouse uses isolated local SQLite services and a full anonymous production-KU report, with no external account credentials.
module.exports = {
  ci: {
    collect: {
      chromePath: process.env.CHROME_PATH,
      startServerCommand: 'pnpm exec tsx scripts/test-services.ts --web --production',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 120000,
      url: [
        'http://localhost:38100/zh',
        'http://localhost:38100/zh/today',
        'http://localhost:38100/zh/bazi/r/local/33333333-3333-4333-8333-333333333333',
        'http://localhost:38100/zh/synastry/r/local/44444444-4444-4444-8444-444444444444',
        'http://localhost:38100/zh/today/calendar',
      ],
      numberOfRuns: 3,
      puppeteerScript: './scripts/lighthouse-setup.cjs',
      puppeteerLaunchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
      settings: {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 1,
          disabled: false,
        },
        disableStorageReset: true,
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85, aggregationMethod: 'pessimistic' }],
        'categories:accessibility': ['error', { minScore: 0.9, aggregationMethod: 'pessimistic' }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
