import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { chromium, type Browser } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { localWorkerConfigs } from './cloudflare-local-configs';
const port = 8803;
const base = process.env.PERF_WEB_URL ?? `http://localhost:${port}`;
const phase = process.env.PERF_WEB_PHASE ?? 'after';
let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;
let serverLog = '';
try {
  if (!process.env.PERF_WEB_URL) {
    const configs = await localWorkerConfigs(port);
    server = spawn(
      'pnpm',
      [
        'exec',
        'wrangler',
        'dev',
        ...configs.flatMap((config) => ['-c', config]),
        '--port',
        String(port),
        '--local',
        '--persist-to',
        resolve('apps/web/.wrangler/state'),
      ],
      {
        cwd: resolve('apps/web'),
        detached: process.platform !== 'win32',
        // DESIGN-GAP: Per-segment assets exceed macOS's fd limit for Wrangler's per-file asset watcher, which then fails spawn with EBADF; these local servers poll instead, and deployment is unaffected.
        env: {
          ...process.env,
          WRANGLER_SEND_METRICS: 'false',
          CHOKIDAR_USEPOLLING: 'true',
          CHOKIDAR_INTERVAL: '600000',
        },
      },
    );
    await new Promise<void>((ready, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Perf server startup timeout: ${serverLog.slice(-2000)}`)),
        90000,
      );
      const data = (chunk: Buffer) => {
        serverLog += chunk.toString();
        if (/Ready on http/.test(serverLog)) {
          clearTimeout(timer);
          ready();
        }
      };
      server?.stdout?.on('data', data);
      server?.stderr?.on('data', data);
      server?.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      server?.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Perf server exited ${code}: ${serverLog.slice(-2000)}`));
      });
    });
  }
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    timezoneId: 'Asia/Singapore',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 230,
    downloadThroughput: 10_000_000 / 8,
    uploadThroughput: 10_000_000 / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const timings = { lcp: 0, lastLongTask: 0 };
    Object.assign(window, { perfWebTimings: timings });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) timings.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        timings.lastLongTask = entry.startTime + entry.duration;
    }).observe({ type: 'longtask', buffered: true });
  });
  const scripts: { path: string; raw: number; gzip: number; br: number }[] = [];
  const bodies: Promise<void>[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (!new URL(response.url()).pathname.endsWith('.js')) return;
    bodies.push(
      response
        .body()
        .then((body) => {
          scripts.push({
            path: new URL(response.url()).pathname,
            raw: body.length,
            gzip: gzipSync(body).length,
            br: brotliCompressSync(body).length,
          });
        })
        .catch(() => undefined),
    );
  });
  await page.goto(`${base}/zh`, { waitUntil: 'load' });
  await page.waitForSelector('.navigation-progress[data-ready="true"]');
  // DESIGN-GAP: Include viewport prefetch and automatic delayed downloads in a ten-second observation window; compressed sizes are computed from decoded responses because local workerd does not simulate edge Brotli.
  await page.waitForTimeout(10000);
  await Promise.all(bodies);
  const home = await page.evaluate(() => {
    const timing = (
      window as typeof window & { perfWebTimings: { lcp: number; lastLongTask: number } }
    ).perfWebTimings;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      ...timing,
      loadMs: nav.loadEventEnd,
      ttiQuietMs: Math.max(timing.lastLongTask, ...resources.map((r) => r.responseEnd)) + 500,
      requests: resources.length + 1,
    };
  });
  await page.screenshot({ path: `.test-data/perf-web-3-home-${phase}.png` });
  const initial = scripts.slice();
  const acknowledgement = page.locator('.disclaimer-confirm');
  if (await acknowledgement.isVisible()) {
    await acknowledgement.click();
    await page.waitForSelector('.disclaimer-confirm', { state: 'hidden' });
  }
  await page.route('**/*', async (route) => {
    if (route.request().headers().rsc === '1')
      await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  const feedback = await page.evaluate(async () => {
    const link = document.querySelector<HTMLAnchorElement>('.desktop-nav a[href$="/bazi"]');
    if (!link) throw new Error('Missing navigation');
    const start = performance.now();
    link.click();
    while (
      !document.querySelector('.navigation-progress[data-active="true"]') &&
      location.pathname !== '/zh/bazi'
    ) {
      if (performance.now() - start > 3000) throw new Error('Navigation has no visible feedback');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return performance.now() - start;
  });
  await page.waitForURL('**/zh/bazi');
  const dailyWorkers: string[] = [];
  page.on('request', (request) => {
    if (/\/workers\/(?:br\/)?daily-/.test(request.url())) dailyWorkers.push(request.url());
  });
  await page.goto(`${base}/zh/today`);
  await page.waitForSelector('[data-daily-block="13"]', { state: 'attached' });
  if (phase === 'after')
    assert.deepEqual(dailyWorkers, [], 'Public example loaded a daily computation worker');

  const total = initial.reduce(
    (sum, script) => ({
      raw: sum.raw + script.raw,
      gzip: sum.gzip + script.gzip,
      br: sum.br + script.br,
    }),
    { raw: 0, gzip: 0, br: 0 },
  );
  const report = {
    phase,
    profile: { rttMs: 230, downMbps: 10, cpuSlowdown: 4 },
    home: { ...home, jsRequests: initial.length, ...total },
    navigationFeedbackMs: feedback,
    scripts: initial,
    errors,
  };
  await mkdir('.test-data', { recursive: true });
  await writeFile(`.test-data/perf-web-3-${phase}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, scripts: undefined }, null, 2));
  if (phase === 'after') {
    assert.ok(total.gzip <= 300_000, `Home transfer ${total.gzip} exceeds 300KB`);
    assert.ok(total.raw <= 1_000_000, `Home decoded ${total.raw} exceeds 1MB`);
    assert.ok(
      !initial.some((s) => /\/workers\//.test(s.path)),
      'Homepage loaded a computation worker',
    );
    const lazy = JSON.parse(
      await readFile('apps/web/.next/react-loadable-manifest.json', 'utf8'),
    ) as Record<string, { files: string[] }>;
    const threeFiles = new Set(
      Object.entries(lazy)
        .filter(([key]) => key.includes('three/'))
        .flatMap(([, value]) => value.files.map((file) => '/_next/' + file)),
    );
    assert.ok(
      !initial.some((s) => threeFiles.has(s.path)),
      'Homepage loaded Three before interaction',
    );
    assert.ok(feedback <= 100, `Navigation feedback ${feedback} exceeds 100ms`);
    assert.deepEqual(errors, []);
  }
} finally {
  await browser?.close();
  if (server?.pid) process.kill(process.platform === 'win32' ? server.pid : -server.pid, 'SIGTERM');
}
