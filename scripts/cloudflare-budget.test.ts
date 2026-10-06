import { expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { assertWorkerBudget, workerSize } from './cloudflare-budget-size';

it('counts actual Wrangler JS, WASM and font uploads, excluding maps and analysis reports', () => {
  const modules = [
    { name: 'worker.js', contents: new TextEncoder().encode('export default { fetch() {} };') },
    { name: 'query_compiler.wasm', contents: Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0) },
    { name: 'font.bin', contents: Uint8Array.of(42, 43, 44) },
  ];
  const result = workerSize([
    ...modules,
    { name: 'worker.js.map', contents: new Uint8Array(10_000) },
    { name: 'metafile.json', contents: new Uint8Array(20_000) },
  ]);
  expect(result.rawBytes).toBe(modules.reduce((sum, m) => sum + m.contents.length, 0));
  expect(result.gzipBytes).toBe(modules.reduce((sum, m) => sum + gzipSync(m.contents).length, 0));
  expect(result.modules.map((m) => m.name)).toEqual(modules.map((m) => m.name));
  expect(() => workerSize([{ name: 'metafile.json', contents: new Uint8Array() }])).toThrow(
    'Worker JS is missing',
  );
});

it('accepts 8MB exactly and rejects the first byte above it or invalid measurements', () => {
  expect(() => assertWorkerBudget(8_000_000)).not.toThrow();
  expect(() => assertWorkerBudget(8_000_001)).toThrow('exceeds');
  for (const size of [-1, NaN, 0.5, Infinity])
    expect(() => assertWorkerBudget(size)).toThrow('Invalid');
});
