import { testDatabaseUrl } from './sqlite-test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { perfSnapshot } from './perf-fixture';
await writeFile('/tmp/destiny-perf-fixture.json', await perfSnapshot());
const child = spawn('pnpm', ['exec', 'lhci', 'autorun', '--config=lighthouserc.cjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CHROME_PATH: chromium.executablePath(),
    TEST_SERVICE_PORT_OFFSET: '2000',
    TEST_WEB_PORT: '38100',
    TEST_WEB_MODE: 'production',
    // DESIGN-GAP: Production-mode Node tests use the guarded loopback mail mock with isolated credentials.
    TEST_MAIL_URL: 'http://127.0.0.1:60081/mail',
    EMAIL_FROM: 'noreply@send.gavin.pub',
    EMAIL_FROM_NAME: '天机 DestinyOS',
    LOCAL_DATABASE_URL: testDatabaseUrl(57432),
    AUTH_SECRET: 'isolated-lighthouse-secret',
    AUTH_URL: 'http://localhost:38100',
    AUTH_TRUST_HOST: 'true',
    FIELD_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString('base64')}`,
  },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
