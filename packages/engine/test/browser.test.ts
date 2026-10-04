import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import type {
  compute as computeType,
  normalizeBirth as normalizeType,
  hashSeed as hashType,
  createRandom as randomType,
} from '../src';
import A from './fixtures/birth/A.json';

it('bundles and executes without Node globals, network, clock or unseeded randomness', async () => {
  const bundle = await build({
    entryPoints: ['packages/engine/src/index.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'TianjiEngine',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  expect(
    Object.values(bundle.metafile.outputs)
      .flatMap((input) => input.imports)
      .filter((input) => input.external),
  ).toEqual([]);
  const context: {
    TextEncoder: typeof TextEncoder;
    TextDecoder: typeof TextDecoder;
    TianjiEngine?: {
      compute: typeof computeType;
      normalizeBirth: typeof normalizeType;
      hashSeed: typeof hashType;
      createRandom: typeof randomType;
    };
  } = { TextEncoder, TextDecoder };
  runInNewContext(bundle.outputFiles[0]!.text, context);
  const engine = context.TianjiEngine!;
  expect(engine.hashSeed('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  expect(engine.createRandom('browser').next()).toBeGreaterThanOrEqual(0);
  const birth = engine.normalizeBirth(A);
  expect(birth.utc).toBe('1990-05-14T23:30:00Z');
  expect(
    engine.compute({ system: 'bazi', birth, now: '2026-10-04T00:00:00Z' }).meta.debug?.placeholder,
  ).toBe(true);
  // Browser-realm builtins must also be prohibited, rather than mocking only the test runner's clock.
  runInNewContext(
    "Date.now = () => { throw new Error('system clock'); }; Math.random = () => { throw new Error('unseeded randomness'); };",
    context,
  );
  expect(engine.normalizeBirth(A)).toEqual(birth);
  expect(
    engine.compute({ system: 'tarot', now: '2026-10-04T00:00:00Z', seed: 'browser' }).computedAt,
  ).toBe('2026-10-04T00:00:00Z');
  expect(engine.createRandom('browser').next()).toBeGreaterThanOrEqual(0);
  const iching = engine.compute({
    system: 'iching',
    now: '2026-10-04T00:00:00Z',
    seed: 'browser',
    question: {
      method: 'meihua',
      category: 'other',
      meihua: { castBy: 'random', at: '2026-10-04T08:00[Asia/Shanghai]' },
    },
  });
  expect(iching.chart.primary).toBeDefined();
  expect(
    engine.compute({
      system: 'qimen',
      now: '2026-10-04T07:30Z',
      question: { at: '2026-10-04T15:30[Asia/Shanghai]' },
    }).chart.ju,
  ).toBe(4);
});
