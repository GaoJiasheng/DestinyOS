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

// DESIGN-GAP: The app manifest omits the automatically loaded root error boundary; measure the actual homepage script set as well.
const homeHtml = await readFile(directory + 'server/app/zh.html', 'utf8');
const documentFiles = [...homeHtml.matchAll(/src="(\/_next\/[^"?]+\.js)(?:\?[^" ]*)?"/g)].map(
  (match) => decodeURIComponent(match[1]!).replace('/_next/', ''),
);
assert.ok(documentFiles.length > 0, 'Homepage document scripts missing');
const documentBytes = await bytes(documentFiles);
const decodedBytes = (
  await Promise.all(
    [...new Set(documentFiles)].map(async (file) => (await readFile(directory + file)).length),
  )
).reduce((sum, size) => sum + size, 0);
assert.ok(documentBytes <= 300_000, `Home document transfer exceeds 300KB: ${documentBytes}`);
assert.ok(decodedBytes <= 1_000_000, `Home document decoded JS exceeds 1MB: ${decodedBytes}`);
const forbidden = new Set(threeEntries.flatMap(([, value]) => value.files));
assert.ok(
  documentFiles.every((file) => !forbidden.has(file)),
  'Homepage eagerly loads Three/R3F',
);
assert.ok(!/workers\/(?:br\/)?daily-/.test(homeHtml), 'Homepage preloads the daily worker');
const errorFiles = (pages['/global-error'] ?? []).filter((file) =>
  /app\/global-error.*\.js$/.test(file),
);
assert.equal(errorFiles.length, 1, 'Missing root error component');
const errorRaw = (await readFile(directory + errorFiles[0]!)).length;
assert.ok(errorRaw <= 20_000, `global-error exceeds 20KB raw: ${errorRaw}`);
console.log(
  `Home document: ${documentBytes} gzip / ${decodedBytes} decoded bytes; global-error ${errorRaw} raw bytes`,
);
const { isStaticPublicPath } = await import('../apps/web/lib/static-public-path');
const prerenders = JSON.parse(await readFile(directory + 'prerender-manifest.json', 'utf8')) as {
  routes: Record<string, unknown>;
};
for (const locale of ['zh', 'en', 'zh-TW']) {
  for (const path of [
    '',
    '/bazi',
    '/ziwei',
    '/iching',
    '/qimen',
    '/tarot',
    '/astrology',
    '/vedic',
    '/numerology',
    '/synastry',
    '/today',
    '/learn',
    '/faq',
    '/about',
    '/privacy',
    '/terms',
    '/disclaimer',
    '/contact',
    '/credits',
  ])
    assert.ok(
      prerenders.routes[`/${locale}${path}`],
      `Public route entered dynamic rendering: /${locale}${path}`,
    );
}
assert.ok(await readFile('apps/web/public/robots.txt', 'utf8'));
for (const route of ['/sitemap.xml', '/manifest.webmanifest'])
  assert.ok(prerenders.routes[route], `Metadata became dynamic: ${route}`);
if (process.env.PERF_STATIC_ASSETS_REQUIRED === 'true') {
  const build = JSON.parse(
    await readFile('apps/web/.open-next/static-assets-build.json', 'utf8'),
  ) as { buildId: string; routes: string[] };
  assert.equal(build.buildId, (await readFile(directory + 'BUILD_ID', 'utf8')).trim());
  for (const route of Object.keys(prerenders.routes).filter(isStaticPublicPath)) {
    assert.ok(build.routes.includes(route), `Missing asset registry: ${route}`);
    for (const extension of ['html', 'rsc']) {
      const source = await readFile(directory + `server/app${route}.${extension}`);
      const asset = await readFile(`apps/web/.open-next/assets${route}.${extension}`);
      assert.deepEqual(asset, source, `Static payload differs: ${route}.${extension}`);
    }
    assert.deepEqual(
      await readFile(`apps/web/.open-next/assets${route}._tree.segment.rsc`),
      await readFile(directory + `server/app${route}.segments/_tree.segment.rsc`),
      `Static route tree differs: ${route}`,
    );
  }
  const config = await readFile('apps/web/wrangler.toml', 'utf8');
  assert.ok(config.includes('html_handling = "drop-trailing-slash"'));
  assert.ok(
    config.includes('run_worker_first = ["/api/*", "/admin/*", "/s/*", "/_smoke/*"]'),
    'Public paths must not run Worker first',
  );
  console.log(`Static Assets: ${build.routes.length} HTML + Flight routes verified`);
}
