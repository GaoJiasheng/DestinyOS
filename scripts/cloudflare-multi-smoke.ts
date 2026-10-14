import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { localWorkerConfigs } from './cloudflare-local-configs';
import { p75 } from './perf-ttfb-support';
import { dailyExamplePath } from '../apps/web/lib/daily-example';
import { localToday } from '../apps/web/lib/daily-date';
import { mobileMultiSmoke } from './cloudflare-mobile-smoke';
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
  assert.equal(cold.renderer, 'static-assets');
  assert.equal(cold.timing, null, 'Public HTML must bypass Worker execution');
  const results = [];
  for (const path of ['/zh', '/en', '/zh/tarot', '/zh/qimen', '/zh/learn', '/zh/today']) {
    for (const prefetch of [false, true]) {
      const samples = [];
      for (let index = 0; index < 10; index++)
        samples.push(
          await probe(`${path}.rsc?_rsc=sample-${index}`, {
            RSC: '1',
            ...(prefetch ? { 'Next-Router-Prefetch': '1' } : {}),
          }),
        );
      assert.ok(
        samples.every((sample) => sample.renderer === 'static-assets' && sample.timing === null),
        `${path}: public Flight initialized compute`,
      );
      const observed = p75(samples.map((sample) => sample.ttfbMs));
      assert.ok(observed <= 300, `${path}: P75 ${observed}ms exceeds 300ms`);
      assert.ok(
        samples.every((sample) => sample.cache === null),
        `${path}: Static Flight executed Worker cache`,
      );
      if (['/zh/learn', '/zh/today'].includes(path))
        assert.ok(
          samples.every((sample) => sample.bytes <= 120000),
          `${path}: Flight exceeds 120KB`,
        );
      results.push({ path, prefetch, p75Ms: observed, samples });
    }
  }
  const logged = await probe('/zh/learn.rsc?_rsc=logged', {
    RSC: '1',
    cookie: 'authjs.session-token=test-session',
  });
  assert.equal(logged.cache, null, 'Public Flight must bypass Worker storage');
  assert.equal(logged.renderer, 'static-assets');
  for (const path of ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest']) {
    const metadata = await probe(path);
    assert.equal(metadata.renderer, 'static-assets');
    assert.equal(metadata.timing, null);
  }
  for (const locale of ['zh', 'en', 'zh-TW'] as const) {
    const example = await probe(
      dailyExamplePath(locale, 'Asia/Singapore', localToday('Asia/Singapore')),
    );
    assert.equal(example.renderer, 'static-assets');
    assert.equal(example.timing, null, 'Public demonstration report must not initialize compute');
  }
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
  // DESIGN-GAP: Static assets remain readable during maintenance; costly actions still trip the live gate.
  await fetch(`${base}/_smoke/circuit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'open' }),
  });
  try {
    assert.equal((await probe('/zh')).renderer, 'static-assets');
    assert.equal((await probe('/zh.rsc', { RSC: '1' })).renderer, 'static-assets');
    assert.equal(
      (
        await fetch(`${base}/_actions/zh/today`, {
          method: 'POST',
          headers: { 'Next-Action': 'smoke' },
        })
      ).status,
      503,
    );
  } finally {
    await fetch(`${base}/_smoke/circuit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'closed' }),
    });
  }
  const auth = await probe('/api/auth/providers');
  assert.ok(auth.bytes > 0);
  const mobile = await mobileMultiSmoke(base);
  await mkdir('.test-data', { recursive: true });
  await writeFile(
    '.test-data/perf-web-2.json',
    JSON.stringify(
      {
        startupMs,
        cold,
        results,
        logged,
        publicImage,
        traditionalImage,
        articleImage,
        dailyImage,
        mobile,
      },
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
