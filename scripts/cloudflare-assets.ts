import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
// DESIGN-GAP: Large immutable public data stays in Workers Assets instead of consuming the 64MiB uncompressed Worker limit.
const root = resolve(import.meta.dirname, '..');
const web = resolve(root, 'apps/web');
const assets = resolve(web, '.open-next/assets/_data');
await mkdir(assets, { recursive: true });
for (const [source, target] of [
  ['resources', 'resources'],
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
