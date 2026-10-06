import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import type { Metafile } from 'esbuild';
import { assertWorkerBudget, workerSize } from './cloudflare-budget-size';

const web = resolve(import.meta.dirname, '../apps/web');
const output = resolve(web, '.wrangler/budget-check');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// DESIGN-GAP: Wrangler dry-run uses the actual deployment configuration and nodejs_compat transforms; never upload or write secrets.
const run = spawnSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'deploy',
    '--dry-run',
    '--outdir',
    output,
    '--metafile',
    resolve(output, 'metafile.json'),
  ],
  { cwd: web, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } },
);
await writeFile(resolve(output, 'wrangler.log'), run.stdout + run.stderr);
assert.equal(run.status, 0, run.stderr || run.stdout || run.error?.message);
const files = await Promise.all(
  (await readdir(output)).map(async (name) => ({
    name,
    contents: await readFile(resolve(output, name)),
  })),
);
const report = workerSize(files);
await writeFile(resolve(output, 'size.json'), JSON.stringify(report, null, 2) + '\n');

// DESIGN-GAP: Expand OpenNext's inner esbuild metafile because Wrangler sees a single prebundled server module; keep raw contributions separate from final gzip totals.
const serverMeta = resolve(
  web,
  '.open-next/server-functions/default/apps/web/handler.mjs.meta.json',
);
const metafile = JSON.parse(await readFile(serverMeta, 'utf8')) as Metafile;
const modules = new Map<string, number>();
for (const result of Object.values(metafile.outputs)) {
  for (const [name, input] of Object.entries(result.inputs)) {
    modules.set(name, (modules.get(name) ?? 0) + input.bytesInOutput);
  }
}
const outer = JSON.parse(await readFile(resolve(output, 'metafile.json'), 'utf8')) as Metafile;
const serverHandler = serverMeta.replace(/\.meta\.json$/, '');
for (const result of Object.values(outer.outputs))
  for (const [name, input] of Object.entries(result.inputs)) {
    // The server aggregate was expanded above; retain middleware and Worker bootstrap contributions.
    if (resolve(web, name) !== serverHandler)
      modules.set(name, (modules.get(name) ?? 0) + input.bytesInOutput);
  }
for (const file of report.modules.filter(({ name }) => /\.(?:wasm|bin)$/.test(name)))
  modules.set(file.name, file.rawBytes);
const ranked = [...modules]
  .map(([name, bytes]) => ({ name: relative(web, resolve(web, name)), bytes }))
  .sort((a, b) => b.bytes - a.bytes);
await writeFile(resolve(output, 'modules.json'), JSON.stringify(ranked, null, 2) + '\n');
console.table(ranked.slice(0, 30));
// DESIGN-GAP: Fail on accidental Node adapter reintroduction even if the total remains under budget.
for (const { name } of ranked)
  assert.ok(
    !/(?:playwright-core|geo-tz|@sparticuz\/chromium|better-sqlite3|@vercel\/blob|pino)\//.test(
      name,
    ),
    `Node-only dependency bundled in Worker: ${name}`,
  );
assertWorkerBudget(report.gzipBytes);
console.log(
  `Cloudflare Worker: raw ${report.rawBytes} bytes; gzip ${report.gzipBytes} / ${report.maxGzipBytes} bytes — passed`,
);
