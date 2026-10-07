import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

// DESIGN-GAP: Use decimal MB for the task's 8MB CI limit, stricter than Cloudflare's MiB limit.
export const maxWorkerRawBytes = 8_000_000;
export const maxWorkerGzipBytes = 8_000_000;
export const targetWorkerGzipBytes = 6_000_000;

/** Measure uploaded JS, WASM and binary modules; source maps and analysis files are not executable modules. */
export function workerSize(files: ReadonlyArray<{ name: string; contents: Uint8Array }>) {
  const modules = files
    .filter(({ name }) => /\.(?:js|mjs|wasm|bin)$/.test(name))
    .map(({ name, contents }) => ({
      name,
      rawBytes: contents.byteLength,
      gzipBytes: gzipSync(contents).byteLength,
    }));
  assert.ok(
    modules.some(({ name }) => /\.(?:js|mjs)$/.test(name)),
    'Worker JS is missing',
  );
  return {
    maxRawBytes: maxWorkerRawBytes,
    rawBytes: modules.reduce((sum, file) => sum + file.rawBytes, 0),
    gzipBytes: modules.reduce((sum, file) => sum + file.gzipBytes, 0),
    maxGzipBytes: maxWorkerGzipBytes,
    targetGzipBytes: targetWorkerGzipBytes,
    modules,
  };
}

/** Fail CI above the upload budget, including every separately uploaded binary module. */
export function assertWorkerBudget(gzipBytes: number): void {
  assert.ok(Number.isSafeInteger(gzipBytes) && gzipBytes >= 0, 'Invalid Worker gzip size');
  assert.ok(
    gzipBytes <= maxWorkerGzipBytes,
    `Worker gzip ${gzipBytes} bytes exceeds ${maxWorkerGzipBytes} bytes (8MB)`,
  );
}

/** Raw executable bytes govern main-isolate parsing, independently of the upload compression limit. */
export function assertWorkerRawBudget(rawBytes: number, maximum = maxWorkerRawBytes): void {
  assert.ok(Number.isSafeInteger(rawBytes) && rawBytes >= 0, 'Invalid Worker raw size');
  assert.ok(rawBytes <= maximum, `Worker raw ${rawBytes} bytes exceeds ${maximum} bytes`);
}
