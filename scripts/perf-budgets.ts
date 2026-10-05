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

// DESIGN-GAP: No per-feature JS cap is specified; guard profile lists at 220KB, new inputs/calendar at 260KB and shared reports at 350KB gzip (birth input at 400KB), including the locale shell but excluding lazy editors/charts/workers.
const routes = [
  ['/[locale]/(app)/me/profiles/page', 220],
  ['/[locale]/(app)/rectify/page', 260],
  ['/[locale]/(app)/synastry/page', 260],
  ['/[locale]/(app)/today/calendar/page', 260],
  ['/[locale]/(app)/[system]/new/page', 400],
  ['/[locale]/(app)/[system]/r/[id]/page', 350],
  ['/[locale]/(app)/[system]/r/local/[id]/page', 350],
  ['/[locale]/(app)/[system]/r/[id]/chat/page', 220],
  ['/[locale]/(marketing)/learn/[system]/articles/[slug]/page', 220],
] as const;
for (const [route, limit] of routes) {
  const files = pages[route];
  assert.ok(files?.length, `Missing new-feature production route: ${route}`);
  const total = await bytes([...shell, ...files]);
  assert.ok(total <= limit * 1024, `${route}: ${total} gzip bytes exceeds ${limit}KB`);
  console.log(`${route}: ${total} gzip bytes (budget ${limit}KB)`);
}
for (const [entry, chunk] of Object.entries(lazy).filter(([key]) =>
  /synastry-chart|numerology-chart|birth-form/.test(key),
)) {
  const total = await bytes(chunk.files);
  assert.ok(total <= 220 * 1024, `${entry}: lazy chunk exceeds 220KB`);
  console.log(`${entry}: ${total} lazy gzip bytes`);
}

// DESIGN-GAP: No worker transfer cap is specified; bound the new on-demand calendar worker at 250KB Brotli, including Taiwan localization.
const worker = z
  .object({ calendarUrl: z.string().regex(/^\/workers\/br\/calendar-[a-f0-9]{16}\.js$/) })
  .parse(JSON.parse(await readFile('apps/web/lib/daily-worker-asset.json', 'utf8')));
const calendarBytes = (await readFile(`apps/web/public${worker.calendarUrl}`)).byteLength;
assert.ok(calendarBytes <= 250 * 1024, `Calendar worker exceeds 250KB Brotli: ${calendarBytes}`);
console.log(`Calendar worker: ${calendarBytes} Brotli bytes (budget 250KB)`);
