import { it, expect } from 'vitest';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { DailyChartSchema } from '@tianji/shared';
import {
  compute,
  computeBazi,
  computeAstrology,
  computeDaily,
  normalizeBirth,
  hashSeed,
} from '../src';
import A from './fixtures/birth/A.json';
import golden from './fixtures/daily/A.json';
const systems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
] as const;
const now = '2026-10-04T04:00:00Z',
  seed = hashSeed('fixture-A|2026-10-04');
// DESIGN-GAP: Cross-V8 astronomical positions/finite-difference speeds use 1e-6 absolute tolerance (far below ±1′); all identifiers and structure remain exact.
function expectBrowserParity(actual: unknown, expected: unknown, path = 'result'): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    expect(Math.abs(Number(actual) - expected), path).toBeLessThanOrEqual(1e-6);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    if (!Array.isArray(actual)) throw new Error(path);
    expect(actual.length, path).toBe(expected.length);
    expected.forEach((item: unknown, index: number) =>
      expectBrowserParity(actual[index], item, `${path}[${index}]`),
    );
  } else if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object') throw new Error(path);
    const a = actual as Record<string, unknown>,
      e = expected as Record<string, unknown>;
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(e).sort());
    for (const key of Object.keys(e)) expectBrowserParity(a[key], e[key], `${path}.${key}`);
  } else expect(actual, path).toEqual(expected);
}
it('runs the published @tianji/engine ESM surface for all eight systems and daily in real Chromium offline', async () => {
  // Resolve the actual workspace package exports from a consumer, rather than just evaluating TS in node:vm.
  const bundle = await build({
    stdin: {
      contents: "export * from '@tianji/engine';",
      resolveDir: resolve('packages/interpret'),
      sourcefile: 'browser-consumer.ts',
    },
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minify: true,
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  expect(
    Object.values(bundle.metafile.outputs)
      .flatMap((output) => output.imports)
      .filter((item) => item.external),
  ).toEqual([]);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ offline: true });
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    const moduleUrl = await page.evaluate(
      (code) => URL.createObjectURL(new Blob([code], { type: 'text/javascript' })),
      bundle.outputFiles[0]!.text,
    );
    // A native module script keeps the browser import out of Vitest's SSR transform.
    await page.addScriptTag({
      type: 'module',
      content: `import * as engine from '${moduleUrl}'; globalThis.TianjiEngine = engine;`,
    });
    await page.waitForFunction(() => 'TianjiEngine' in globalThis, undefined, { timeout: 10_000 });
    const result = await page.evaluate(
      ({ fixture, systems, now, seed, moduleUrl }) => {
        const engine = (globalThis as typeof globalThis & { TianjiEngine: typeof import('../src') })
          .TianjiEngine;
        URL.revokeObjectURL(moduleUrl);
        Date.now = () => {
          throw new Error('system clock forbidden');
        };
        Math.random = () => {
          throw new Error('unseeded randomness forbidden');
        };
        globalThis.fetch = () => {
          throw new Error('network forbidden');
        };
        const birth = engine.normalizeBirth(fixture);
        const results = systems.map((system) => engine.compute({ system, birth, now, seed }));
        const dailyInput = {
          birth,
          baziChart: engine.computeBazi(birth, { now, yearsAround: 0 }),
          astroChart: engine.computeAstrology(birth),
          vedicChart: null,
          date: { local: '2026-10-04', tz: 'Asia/Shanghai' },
          seed,
        };
        const daily = engine.computeDaily(dailyInput);
        return {
          birth,
          results,
          resultsRepeat: systems.map((system) => engine.compute({ system, birth, now, seed })),
          daily,
          dailyRepeat: engine.computeDaily(dailyInput),
          uniformDaily: engine.compute({ system: 'daily', birth, now, seed }),
        };
      },
      { moduleUrl, fixture: A, systems: [...systems], now, seed },
    );
    const birth = normalizeBirth(A);
    expect(result.birth).toEqual(birth);
    const expected = systems.map((system) => compute({ system, birth, now, seed }));
    // Browser and Node execute the same deterministic ESM API for all eight systems.
    expectBrowserParity(result.results, expected);
    expect(result.resultsRepeat).toEqual(result.results);
    const daily = DailyChartSchema.parse(result.daily);
    expect(daily).toEqual(golden);
    expect(result.dailyRepeat).toEqual(daily);
    expect(result.uniformDaily.chart).toEqual(daily);
    expect(daily).toEqual(
      computeDaily({
        birth,
        baziChart: computeBazi(birth, { now, yearsAround: 0 }),
        astroChart: computeAstrology(birth),
        vedicChart: null,
        date: { local: '2026-10-04', tz: 'Asia/Shanghai' },
        seed,
      }),
    );
  } finally {
    await browser.close();
  }
}, 90_000);
it('builds every public system subpath as standalone browser ESM within the 350 KiB gzip budget', async () => {
  for (const path of ['common', ...systems, 'daily']) {
    const bundle = await build({
      stdin: {
        contents: `export * from '@tianji/engine/${path}';`,
        resolveDir: resolve('packages/interpret'),
        sourcefile: 'browser-consumer.ts',
      },
      bundle: true,
      platform: 'browser',
      format: 'esm',
      minify: true,
      write: false,
      logLevel: 'silent',
      metafile: true,
    });
    expect(
      Object.values(bundle.metafile.outputs)
        .flatMap((output) => output.imports)
        .filter((item) => item.external),
    ).toEqual([]);
    expect(gzipSync(bundle.outputFiles[0]!.contents).length, path).toBeLessThanOrEqual(350 * 1024);
  }
}, 30_000);
