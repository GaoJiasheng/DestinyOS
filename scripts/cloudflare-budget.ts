import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import type { Metafile } from 'esbuild';
import { assertWorkerBudget, assertWorkerRawBudget, workerSize } from './cloudflare-budget-size';
const web = resolve(import.meta.dirname, '../apps/web');
// DESIGN-GAP: The compute service owns the full dynamic application, with a separate explicit budget; public startup never parses it.
for (const [name, config, maximum] of [
  ['main', 'wrangler.toml', 8_000_000],
  ['compute', 'wrangler.compute.toml', 24_000_000],
  ['media', 'wrangler.media.toml', 8_000_000],
] as const) {
  const output = resolve(web, `.wrangler/budget-check${name === 'main' ? '' : `-${name}`}`);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  let log = '';
  const status = await new Promise<number | null>((done, reject) => {
    const child = spawn(
      'pnpm',
      [
        'exec',
        'wrangler',
        'deploy',
        '--dry-run',
        '--config',
        config,
        '--outdir',
        output,
        '--metafile',
        resolve(output, 'metafile.json'),
      ],
      { cwd: web, env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' } },
    );
    child.stdout.on('data', (chunk: Buffer) => {
      log += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      log += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', done);
  });
  await writeFile(resolve(output, 'wrangler.log'), log);
  assert.equal(status, 0, log);
  const files = await Promise.all(
    (await readdir(output)).map(async (file) => ({
      name: file,
      contents: await readFile(resolve(output, file)),
    })),
  );
  const report = { ...workerSize(files), service: name, maxRawBytes: maximum };
  await writeFile(resolve(output, 'size.json'), JSON.stringify(report, null, 2) + '\n');
  const outer = JSON.parse(await readFile(resolve(output, 'metafile.json'), 'utf8')) as Metafile;
  const modules = Object.values(outer.outputs)
    .flatMap((result) =>
      Object.entries(result.inputs).map(([path, input]) => ({
        name: path,
        bytes: input.bytesInOutput,
      })),
    )
    .sort((a, b) => b.bytes - a.bytes);
  await writeFile(resolve(output, 'modules.json'), JSON.stringify(modules, null, 2) + '\n');
  assertWorkerRawBudget(report.rawBytes, maximum);
  assertWorkerBudget(report.gzipBytes);
  if (name === 'main')
    for (const module of modules)
      assert.ok(
        !/prisma|sentry|opencc|satori|resvg|puppeteer|handler\.mjs/.test(module.name),
        `Heavy dependency in main Worker: ${module.name}`,
      );
  console.log(
    `${name}: raw ${report.rawBytes} / ${maximum}; gzip ${report.gzipBytes} bytes — passed`,
  );
}
