import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// DESIGN-GAP: Parse Wrangler's actual dry-run size; since 2026-09-04 Workers limits uncompressed scripts to 64MiB and treats gzip as informational.
const web = resolve(import.meta.dirname, '../apps/web');
let output: string;
try {
  output = execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'deploy', '--dry-run', '--outdir', '.wrangler/budget-check'],
    { cwd: web, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 },
  );
} catch {
  throw new Error('Wrangler dry-run failed; run it from apps/web for diagnostics.');
}
const size = output.match(/Total Upload:\s*([\d.]+) KiB \/ gzip:\s*([\d.]+) KiB/);
assert.ok(size, 'Wrangler did not report a Worker size');
const uncompressedKiB = Number(size[1]);
const compressedKiB = Number(size[2]);
assert.ok(Number.isFinite(uncompressedKiB) && uncompressedKiB > 0, 'Invalid Worker size');
assert.ok(Number.isFinite(compressedKiB) && compressedKiB > 0, 'Invalid compressed Worker size');
assert.ok(
  uncompressedKiB <= 64 * 1024,
  `Worker ${uncompressedKiB.toFixed(2)} KiB exceeds Workers 65536 KiB`,
);
console.log(
  `Cloudflare Worker: ${uncompressedKiB.toFixed(2)} / 65536 KiB; gzip ${compressedKiB.toFixed(2)} KiB — passed`,
);
