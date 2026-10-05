import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// DESIGN-GAP: Emit one content-addressed daily Worker with existing esbuild tooling so the RSC can preload it before local profile decryption; user data is never embedded or transmitted.
// DESIGN-GAP: Root build creates this public asset before Turbo as well, so a restored .next cache cannot omit the ignored worker file on a clean checkout.
const result = await build({
  absWorkingDir: root,
  entryPoints: ['apps/web/lib/daily.worker.ts'],
  tsconfig: 'apps/web/tsconfig.json',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'inline',
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
});
const bytes = result.outputFiles[0]!.contents;
const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const name = `daily-${hash}.js`;
const assets = resolve(root, 'apps/web/public/workers');
await mkdir(assets, { recursive: true });
await writeFile(resolve(assets, name), bytes);
await writeFile(
  resolve(root, 'apps/web/lib/daily-worker-asset.json'),
  JSON.stringify({ url: `/workers/${name}` }, null, 2) + '\n',
);
