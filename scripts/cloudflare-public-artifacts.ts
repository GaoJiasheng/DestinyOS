import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isStaticPublicPath } from '../apps/web/lib/static-public-path';
import { securityHeaders } from '../apps/web/lib/security-headers';
const web = resolve(import.meta.dirname, '../apps/web');
const manifest = JSON.parse(
  await readFile(resolve(web, '.next/prerender-manifest.json'), 'utf8'),
) as { routes: Record<string, unknown> };
const registry: Record<string, { html: string; rsc: string }> = {};
const assets = resolve(web, '.open-next/assets');
// DESIGN-GAP: Public HTML and full Flight live at canonical asset paths; the Worker compatibility path reads the same files without duplicating the asset tree.
for (const route of Object.keys(manifest.routes)) {
  if (!isStaticPublicPath(route)) continue;
  const files = { html: route, rsc: `${route}.rsc` };
  for (const kind of ['html', 'rsc']) {
    const source = resolve(web, '.next/server/app', `${route.slice(1)}.${kind}`);
    const target = resolve(assets, `.${route}.${kind}`);
    await mkdir(resolve(target, '..'), { recursive: true });
    await cp(source, target);
  }
  registry[route] = files;
}
for (const locale of ['zh', 'en', 'zh-TW']) {
  for (const path of [
    '',
    '/today',
    '/synastry',
    '/bazi',
    '/ziwei',
    '/iching',
    '/qimen',
    '/tarot',
    '/astrology',
    '/vedic',
    '/numerology',
    '/learn',
    '/faq',
    '/privacy',
    '/terms',
    '/about',
    '/contact',
    '/credits',
    '/disclaimer',
  ])
    assert.ok(registry[`/${locale}${path}`], `Public route is not prerendered: /${locale}${path}`);
}
// DESIGN-GAP: Next metadata routes are materialized as Static Assets after build; runtime locale/cookie logic never touches crawlers or install metadata.
for (const route of ['sitemap.xml', 'manifest.webmanifest']) {
  assert.ok(manifest.routes[`/${route}`], `${route} must be a static metadata route`);
  await cp(resolve(web, '.next/server/app', `${route}.body`), resolve(assets, route));
}
const headers = await readFile(resolve(web, 'public/_headers'), 'utf8');
await writeFile(
  resolve(assets, '_headers'),
  headers +
    '\n' +
    [
      '/zh',
      '/zh.rsc',
      '/zh/*',
      '/en',
      '/en.rsc',
      '/en/*',
      '/zh-TW',
      '/zh-TW.rsc',
      '/zh-TW/*',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
    ]
      .map(
        (path) =>
          `${path}\n  Cache-Control: public, max-age=0, must-revalidate\n  X-Destiny-Renderer: static-assets\n${securityHeaders()
            .map(({ key, value }) => `  ${key}: ${value}`)
            .join('\n')}`,
      )
      .join('\n') +
    '\n/*.rsc\n  Content-Type: text/x-component\n',
);
await writeFile(resolve(web, '.open-next/public-artifacts.json'), JSON.stringify(registry) + '\n');
console.log(
  `Prepared ${Object.keys(registry).length} public HTML/Flight assets and static metadata.`,
);
await writeFile(
  resolve(web, '.open-next/static-assets-build.json'),
  JSON.stringify({
    buildId: (await readFile(resolve(web, '.next/BUILD_ID'), 'utf8')).trim(),
    routes: Object.keys(registry),
  }) + '\n',
);

const { dailyExampleAssets } = await import('./daily-example-assets');
console.log(`Prepared ${await dailyExampleAssets(assets)} public daily demonstration snapshots.`);
