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
    DATABASE_URL:
      'postgresql://postgres:postgres@127.0.0.1:57432/postgres?connection_limit=1&statement_cache_size=0',
    DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:57432/postgres',
    REDIS_URL: 'redis://127.0.0.1:58379',
    AUTH_SECRET: 'isolated-lighthouse-secret',
    AUTH_URL: 'http://localhost:38100',
    AUTH_TRUST_HOST: 'true',
    FIELD_ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString('base64')}`,
  },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
