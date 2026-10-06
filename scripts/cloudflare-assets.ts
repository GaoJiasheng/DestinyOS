import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publicCacheRequest } from '../apps/web/lib/platform/public-cache';
// DESIGN-GAP: Large immutable public data stays in Workers Assets instead of consuming the 64MiB uncompressed Worker limit.
const root = resolve(import.meta.dirname, '..');
const web = resolve(root, 'apps/web');
const assets = resolve(web, '.open-next/assets/_data');
await mkdir(assets, { recursive: true });
for (const [source, target] of [
  ['resources', 'resources'],
  ['public/art/share', 'public/art/share'],
  ['public/art/systems', 'public/art/systems'],
  ['public/art/brand/og-default.png', 'public/art/brand/og-default.png'],
  ['lib/llm/prompts', 'lib/llm/prompts'],
  [
    'node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff',
    'node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff',
  ],
  [
    'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff',
    'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff',
  ],
  ['../../packages/content/dist', 'workspace/packages/content/dist'],
  ['../../packages/content/test/fixtures', 'workspace/packages/content/test/fixtures'],
  ['../../packages/engine/test/fixtures/birth', 'workspace/packages/engine/test/fixtures/birth'],
] as const) {
  const destination = resolve(assets, target);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await cp(resolve(web, source), destination, { recursive: true });
}

// DESIGN-GAP: Glossary messages are read through Assets rather than duplicated in RSC and SSR bundles.
for (const locale of ['zh', 'en', 'zh-TW']) {
  const path = `messages/${locale}/glossary.json`;
  await mkdir(resolve(assets, `messages/${locale}`), { recursive: true });
  await cp(resolve(web, path), resolve(assets, path));
}

await mkdir(resolve(assets, 'geo'), { recursive: true });
const geo = resolve(web, 'node_modules/geo-tz/data');
await cp(resolve(geo, 'timezones-1970.geojson.index.json'), resolve(assets, 'geo/index.json'));
const boundaries = await readFile(resolve(geo, 'timezones-1970.geojson.geo.dat'));
const chunkSize = 4 * 1024 * 1024;
for (let offset = 0; offset < boundaries.length; offset += chunkSize) {
  await writeFile(
    resolve(assets, `geo/${offset / chunkSize}.bin`),
    boundaries.subarray(offset, offset + chunkSize),
  );
}
// DESIGN-GAP: OpenNext copies .env.local into its server defaults; strip every server variable so deployed secrets come only from Worker bindings.
const envFile = resolve(web, '.open-next/cloudflare/next-env.mjs');
const defaults = (await import(envFile)) as Record<string, Record<string, unknown>>;
await writeFile(
  envFile,
  ['production', 'development', 'test']
    .map((mode) => {
      const publicValues = Object.fromEntries(
        Object.entries(defaults[mode] ?? {}).filter(([key]) => key.startsWith('NEXT_PUBLIC_')),
      );
      return `export const ${mode} = ${JSON.stringify(publicValues)};`;
    })
    .join('\n') + '\n',
);

await writeFile(
  resolve(assets, 'workspace/packages/content/test/fixtures/_index.json'),
  JSON.stringify(await readdir(resolve(root, 'packages/content/test/fixtures'))),
);
// DESIGN-GAP: Workers Assets auto-compresses responses and overrides Content-Encoding; expand Next's precompressed Brotli worker files to avoid double encoding.
const { brotliDecompressSync } = await import('node:zlib');
const workers = resolve(web, '.open-next/assets/workers/br');
for (const file of await readdir(workers)) {
  if (file.endsWith('.js'))
    await writeFile(
      resolve(workers, file),
      brotliDecompressSync(await readFile(resolve(workers, file))),
    );
}

// DESIGN-GAP: OpenNext's supported Static Assets cache format includes both HTML and RSC; copy only public prerenders into its worker-only cdn-cgi namespace. R2 remains writable and deployment-versioned.
const cacheRoot = resolve(web, '.open-next/cache');
for (const file of await readdir(cacheRoot, { recursive: true })) {
  if (!file.endsWith('.cache')) continue;
  // DESIGN-GAP: Next 15.5 stores route keys under route-cache/APP_PAGE/<hash>/$/<route>; keep the adapter's full key and support its older plain route format too.
  const marker = '/$/';
  const start = file.includes(marker)
    ? file.lastIndexOf(marker) + marker.length
    : file.indexOf('/') + 1;
  const route = `/${file.slice(start, -'.cache'.length)}`;
  if (!publicCacheRequest(new Request(`https://assets.internal${route}`))) continue;
  const destination = resolve(web, '.open-next/assets/cdn-cgi/_next_cache', file);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await cp(resolve(cacheRoot, file), destination);
}
