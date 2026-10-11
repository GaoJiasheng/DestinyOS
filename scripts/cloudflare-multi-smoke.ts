import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { localWorkerConfigs } from './cloudflare-local-configs';
import { p75 } from './perf-ttfb-support';
const port = 8797;
const base = `http://localhost:${port}`;
const configs = await localWorkerConfigs(port);
let log = '';
const server = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    ...configs.flatMap((config) => ['--config', config]),
    '--port',
    String(port),
    '--local',
    '--persist-to',
    resolve(import.meta.dirname, '../apps/web/.wrangler/state'),
  ],
  {
    cwd: resolve(import.meta.dirname, '../apps/web'),
    detached: process.platform !== 'win32',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
);
const started = performance.now();
try {
  await new Promise<void>((ready, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Multi-worker startup timeout: ${log.slice(-3000)}`)),
      120000,
    );
    const data = (chunk: Buffer) => {
      log += chunk.toString();
      if (/Ready on http/.test(log)) {
        clearTimeout(timeout);
        ready();
      }
    };
    server.stdout.on('data', data);
    server.stderr.on('data', data);
    server.on('error', reject);
    server.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Wrangler exited ${code}: ${log.slice(-3000)}`));
    });
  });
  const startupMs = performance.now() - started;
  const probe = async (path: string, headers: Record<string, string> = {}, payload?: unknown) => {
    const start = performance.now();
    const response = await fetch(`${base}${path}`, {
      headers: payload === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      ...(payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }),
    });
    const ttfbMs = performance.now() - start;
    const body = await response.arrayBuffer();
    if (response.headers.get('Content-Type')?.includes('image/png'))
      assert.deepEqual([...new Uint8Array(body).slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(response.status, 200, `${path}: ${new TextDecoder().decode(body).slice(0, 100)}`);
    return {
      ttfbMs,
      bytes: body.byteLength,
      cache: response.headers.get('X-Destiny-Cache'),
      renderer: response.headers.get('X-Destiny-Renderer'),
      timing: response.headers.get('Server-Timing'),
      type: response.headers.get('Content-Type'),
    };
  };
  // DESIGN-GAP: The first actual application request follows Wrangler's ready marker; startup/tooling latency is reported separately from cold-request TTFB.
  const cold = await probe('/zh');
  assert.ok(cold.ttfbMs <= 400, `Cold first request ${cold.ttfbMs}ms exceeds 400ms`);
  assert.equal(cold.renderer, 'artifact');
  const results = [];
  for (const path of ['/zh', '/en', '/zh/tarot', '/zh/qimen', '/zh/learn', '/zh/today']) {
    for (const prefetch of [false, true]) {
      const samples = [];
      for (let index = 0; index < 10; index++)
        samples.push(
          await probe(`${path}?_rsc=sample-${index}`, {
            RSC: '1',
            ...(prefetch ? { 'Next-Router-Prefetch': '1' } : {}),
          }),
        );
      assert.ok(
        samples.every((sample) => sample.renderer === 'artifact'),
        `${path}: public Flight initialized compute`,
      );
      const observed = p75(samples.map((sample) => sample.ttfbMs));
      assert.ok(observed <= 300, `${path}: P75 ${observed}ms exceeds 300ms`);
      assert.ok(
        samples.filter((sample) => sample.cache === 'HIT').length >= 8,
        `${path}: prefetch=${prefetch} lacks cache hits`,
      );
      if (['/zh/learn', '/zh/today'].includes(path))
        assert.ok(
          samples.every((sample) => sample.bytes <= 120000),
          `${path}: Flight exceeds 120KB`,
        );
      results.push({ path, prefetch, p75Ms: observed, samples });
    }
  }
  const logged = await probe('/zh/learn?_rsc=logged', {
    RSC: '1',
    cookie: 'authjs.session-token=test-session',
  });
  assert.equal(logged.cache, null, 'Logged-in Flight must bypass shared storage');
  const publicImage = await probe('/api/og/public?locale=zh&path=/learn');
  assert.equal(publicImage.type, 'image/png', 'Compute → media binding must render a real PNG');
  const traditionalImage = await probe('/api/og/public?locale=zh-TW&path=/learn');
  assert.equal(traditionalImage.type, 'image/png');
  const articleImage = await probe('/api/og/public?locale=zh-TW&path=/learn/iching/hexagram_01');
  assert.equal(articleImage.type, 'image/png');
  const conversion = await fetch(`${base}/_smoke/media/traditional`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '测试软件数据账户' }),
  });
  assert.equal(conversion.status, 200);
  assert.deepEqual(await conversion.json(), { text: '測試軟體資料帳戶' });
  const dailyImage = await probe(
    '/_smoke/media/card',
    {},
    {
      card: {
        locale: 'zh-TW',
        date: '2026-10-07',
        headline: '穩定前行',
        stars: 3,
        color: '藍色',
        numbers: [3, 7],
        do: ['整理'],
        dont: ['衝動'],
      },
      format: 'landscape',
    },
  );
  assert.equal(dailyImage.type, 'image/png');
  for (const template of ['chart', 'quote', 'synastry']) {
    const image = await probe(
      '/_smoke/media/card',
      {},
      {
        card: {
          locale: 'zh',
          system: template === 'synastry' ? 'synastry' : 'bazi',
          template,
          revealLevel: 0,
          headline: '穩定前行',
          keywords: ['耐心'],
          scores: { career: 3, wealth: 3, love: 3, health: 3, social: 3 },
        },
        format: template === 'quote' ? 'story' : 'landscape',
      },
    );
    assert.equal(image.type, 'image/png');
  }
  const auth = await probe('/api/auth/providers');
  assert.ok(auth.bytes > 0);
  await mkdir('.test-data', { recursive: true });
  await writeFile(
    '.test-data/perf-web-2.json',
    JSON.stringify(
      { startupMs, cold, results, logged, publicImage, traditionalImage, articleImage, dailyImage },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Multi-worker smoke passed: cold ${cold.ttfbMs.toFixed(1)}ms, max public RSC P75 ${Math.max(...results.map((result) => result.p75Ms)).toFixed(1)}ms; zh/zh-TW PNG rendered through MEDIA.`,
  );
} finally {
  await mkdir('.test-data', { recursive: true });
  await writeFile('.test-data/multi-worker.log', log);
  if (server.pid) process.kill(process.platform === 'win32' ? server.pid : -server.pid, 'SIGTERM');
}
