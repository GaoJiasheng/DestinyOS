/* global module, process */
// DESIGN-GAP: T-39 today currently uses its existing placeholder; the report fixture is a full production-KU anonymous report.
module.exports = {
  ci: {
    collect: {
      chromePath: process.env.CHROME_PATH,
      startServerCommand: 'pnpm --filter @tianji/web start --port 38100',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 120000,
      url: [
        'http://localhost:38100/zh',
        'http://localhost:38100/zh/today',
        'http://localhost:38100/zh/bazi/r/local/33333333-3333-4333-8333-333333333333',
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
