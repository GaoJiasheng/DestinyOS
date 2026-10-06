import { createServer as createHttpServer } from 'node:http';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { startStripeMock } from './test-stripe-server';
import { migrateSqlite } from './sqlite-migrate';
import { testDatabaseUrl } from './sqlite-test';
import { TestCache } from './test-cache';
// DESIGN-GAP: File-backed SQLite uses the actual D1 migrations and is shared by browser test processes; no Postgres or Redis daemon is needed.
const portOffset = Number(process.env.TEST_SERVICE_PORT_OFFSET ?? 0);
const testPorts = {
  mail: Number(process.env.TEST_MAIL_PORT ?? 58081 + portOffset),
  web: Number(process.env.TEST_WEB_PORT ?? 3100 + portOffset),
};
const url =
  process.env.LOCAL_DATABASE_URL ??
  testDatabaseUrl(Number(process.env.TEST_DATABASE_ID ?? 55432 + portOffset));
process.env.LOCAL_DATABASE_URL = url;
for (const suffix of ['', '-wal', '-shm']) rmSync(url.slice(5) + suffix, { force: true });
migrateSqlite(url);
const cache = new TestCache(url);
const outbox: unknown[] = [];
const mail = createHttpServer((request, response) => {
  if (request.method === 'POST' && request.url === '/mail') {
    let data = '';
    request.on('data', (chunk: Buffer) => {
      data += chunk.toString();
    });
    request.on('end', () => {
      outbox.push(JSON.parse(data) as unknown);
      response.end('OK');
    });
  } else if (request.url === '/mail') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(outbox));
  } else if (request.url === '/reset' && request.method === 'POST') {
    outbox.length = 0;
    void cache.flushall().then(() => response.end('OK'));
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise<void>((resolve) => mail.listen(testPorts.mail, '127.0.0.1', resolve));
console.log('Test SQLite, KV substitute and mail sink are ready.');
const stripeMock =
  process.env.TEST_STRIPE_MOCK === '1'
    ? await startStripeMock(
        Number(process.env.TEST_STRIPE_PORT ?? 60282),
        `http://localhost:${testPorts.web}`,
      )
    : undefined;
let child: ReturnType<typeof spawn> | undefined;
if (process.argv.includes('--web')) {
  // DESIGN-GAP: Production E2E reuses the same service harness with a prebuilt Next.js server.
  const production =
    process.argv.includes('--production') || process.env.TEST_WEB_MODE === 'production';
  const webCommand = production ? 'start' : 'dev';
  // DESIGN-GAP: Combined polish needs production mail/Stripe interception alongside the isolated chat protocol; compose all preloads only in the test process.
  child = spawn('pnpm', ['--filter', '@tianji/web', webCommand, '--port', String(testPorts.web)], {
    stdio: 'inherit',
    env:
      process.env.TEST_CHAT_MOCK === '1'
        ? {
            ...process.env,
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./test-chat-preload.mjs', import.meta.url).href}${production ? ` --import=${new URL('./test-mail-interceptor.ts', import.meta.url).href}${process.env.TEST_STRIPE_MOCK === '1' ? ` --import=${new URL('./test-stripe-interceptor.ts', import.meta.url).href}` : ''}` : ''}`,
          }
        : production
          ? {
              ...process.env,
              TEST_WEB_MODE: 'production',
              NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx --import ${new URL('./test-mail-interceptor.ts', import.meta.url).href}${process.env.TEST_STRIPE_MOCK === '1' ? ` --import ${new URL('./test-stripe-interceptor.ts', import.meta.url).href}` : ''}`,
            }
          : process.env,
  });
}

async function stop() {
  child?.kill('SIGTERM');
  stripeMock?.close();
  mail.close();
  await cache.quit();
  process.exit(0);
}
process.on('SIGTERM', () => {
  void stop();
});
process.on('SIGINT', () => {
  void stop();
});
