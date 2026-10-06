import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
// DESIGN-GAP: Explicit test vars apply only to the local Wrangler process; no secret put or deploy is invoked.
const variables = {
  PLATFORM: 'cloudflare',
  AUTH_SECRET: 'isolated-cf-smoke-secret',
  AUTH_URL: 'http://localhost:8787',
  AUTH_TRUST_HOST: 'true',
  AUTH_GOOGLE_ID: 'mock-google',
  AUTH_GOOGLE_SECRET: 'mock-secret',
  FIELD_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString('base64')}`,
  STRIPE_SECRET_KEY: 'sk_test_isolated',
  STRIPE_WEBHOOK_SECRET: 'whsec_isolated',
  CRON_SECRET: 'isolated-cron',
  FEATURE_ADS: 'false',
  RESEND_API_KEY: 're_isolated',
};
const child = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    'test/cloudflare-runtime-worker.ts',
    '--port',
    '8787',
    '--local',
    ...Object.entries(variables).flatMap(([k, v]) => ['--var', `${k}:${v}`]),
  ],
  {
    cwd: resolve(import.meta.dirname, '../apps/web'),
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
);
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
process.on('SIGINT', () => {
  child.kill('SIGINT');
});
child.on('exit', (code) => {
  process.exit(code ?? 1);
});
