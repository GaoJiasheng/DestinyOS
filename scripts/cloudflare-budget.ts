import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { builtinModules } from 'node:module';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
// DESIGN-GAP: Measure a minified workerd-targeted bundle locally without invoking wrangler deploy, including the gzip size of emitted WASM modules.
const web = resolve(import.meta.dirname, '../apps/web');
const output = resolve(web, '.wrangler/budget-check');
const result = await build({
  entryPoints: [resolve(web, 'worker.ts')],
  outdir: output,
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  conditions: ['workerd', 'worker', 'browser'],
  mainFields: ['module', 'main'],
  external: [...builtinModules, 'node:*', 'cloudflare:*'],
  loader: { '.wasm': 'file', '.bin': 'file', '.html': 'text' },
  write: false,
  logLevel: 'warning',
});
let raw = 0,
  gzip = 0;
await mkdir(output, { recursive: true });
for (const file of result.outputFiles) {
  raw += file.contents.byteLength;
  gzip += gzipSync(file.contents).byteLength;
  await writeFile(file.path, file.contents);
}
assert.ok(gzip <= 10 * 1024 * 1024, `Worker gzip ${gzip} bytes exceeds 10MiB`);
const report = { rawBytes: raw, gzipBytes: gzip, maxGzipBytes: 10 * 1024 * 1024 };
await writeFile(resolve(output, 'size.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  `Cloudflare Worker: raw ${(raw / 1024).toFixed(2)} KiB; gzip ${(gzip / 1024).toFixed(2)} / 10240 KiB — passed`,
);
