import { readFile } from 'node:fs/promises';
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
for (const [entry, chunk] of Object.entries(lazy).filter(([key]) => key.includes('three/'))) {
  const total = await bytes(chunk.files);
  if (total > 220 * 1024) throw new Error(`${entry} exceeds the 220KB Three.js budget: ${total}`);
  console.log(`${entry}: ${total} gzip bytes`);
}
const homeFiles = [
  ...(pages['/[locale]/layout'] ?? []),
  ...(pages['/[locale]/(marketing)/page'] ?? []),
];
const initial = await bytes(homeFiles);
if (initial > 180 * 1024) throw new Error(`Home initial JS exceeds 180KB: ${initial}`);
console.log(`Home initial JS: ${initial} gzip bytes`);
