import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
const directory = 'apps/web/.next/';
const lazy = z
  .record(z.object({ files: z.array(z.string()) }))
  .parse(JSON.parse(await readFile(directory + 'react-loadable-manifest.json', 'utf8')));
const pages = z
  .object({ pages: z.record(z.array(z.string())) })
  .parse(JSON.parse(await readFile(directory + 'app-build-manifest.json', 'utf8'))).pages;
async function bytes(files: string[]) {
  return (
    await Promise.all(
      [...new Set(files)]
        .filter((file) => file.endsWith('.js'))
        .map(async (file) => gzipSync(await readFile(directory + file)).byteLength),
    )
  ).reduce((sum, n) => sum + n, 0);
}
const threeEntries = Object.entries(lazy).filter(([key]) => key.includes('three/'));
assert.ok(threeEntries.length >= 2, 'Missing lazy Three.js entries in the production manifest');
for (const [entry, chunk] of threeEntries) {
  const total = await bytes(chunk.files);
  if (total > 220 * 1024) throw new Error(`${entry} exceeds the 220KB Three.js budget: ${total}`);
  console.log(`${entry}: ${total} gzip bytes`);
}
// DESIGN-GAP: Missing production manifest routes must fail rather than turn an empty file list into a passing zero-byte budget.
const shell = pages['/[locale]/layout'];
const home = pages['/[locale]/(marketing)/page'];
assert.ok(shell?.length && home?.length, 'Missing homepage or locale layout production chunks');
const homeFiles = [...shell, ...home];
const initial = await bytes(homeFiles);
if (initial > 180 * 1024) throw new Error(`Home initial JS exceeds 180KB: ${initial}`);
console.log(`Home initial JS: ${initial} gzip bytes`);
