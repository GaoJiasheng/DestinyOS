import { build, type Plugin } from 'esbuild';
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// DESIGN-GAP: Emit content-addressed daily Workers with existing esbuild tooling so the RSC can preload it before local profile decryption; user data is never embedded or transmitted.
// DESIGN-GAP: Root build creates this public asset before Turbo as well, so a restored .next cache cannot omit the ignored worker file on a clean checkout.
// DESIGN-GAP: Keep the full OpenCC dictionary in a separate traditional-language worker; zh/en never convert text, and an accidental conversion in the smaller worker fails closed.
const withoutTraditional: Plugin = {
  name: 'daily-without-traditional',
  setup(plugin) {
    plugin.onResolve({ filter: /^opencc-js\/cn2t$/ }, () => ({
      path: 'converter',
      namespace: 'daily-without-traditional',
    }));
    plugin.onLoad({ filter: /.*/, namespace: 'daily-without-traditional' }, () => ({
      contents:
        'export function Converter() { return () => { throw new Error("Traditional worker required"); }; }',
      loader: 'js',
    }));
  },
};
async function emit(traditional: boolean, calendar = false) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [calendar ? 'apps/web/lib/calendar.worker.ts' : 'apps/web/lib/daily.worker.ts'],
    tsconfig: 'apps/web/tsconfig.json',
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    minify: true,
    legalComments: 'inline',
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    plugins: traditional ? [] : [withoutTraditional],
  });
  const bytes = result.outputFiles[0]!.contents;
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const name = `${calendar ? 'calendar' : 'daily'}-${hash}.js`;
  const assets = resolve(root, 'apps/web/public/workers');
  await mkdir(assets, { recursive: true });
  await writeFile(resolve(assets, name), bytes);
  // DESIGN-GAP: Precompress the immutable worker at build time; the static br directory declares Content-Encoding so cold mobile clients download the full corpus with fewer bytes.
  await mkdir(resolve(assets, 'br'), { recursive: true });
  await writeFile(
    resolve(assets, 'br', name),
    brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  );
  return `/workers/br/${name}`;
}
const url = await emit(false);
const traditionalUrl = await emit(true);
const calendarUrl = await emit(true, true);
await writeFile(
  resolve(root, 'apps/web/lib/daily-worker-asset.json'),
  JSON.stringify({ url, traditionalUrl, calendarUrl }, null, 2) + '\n',
);
