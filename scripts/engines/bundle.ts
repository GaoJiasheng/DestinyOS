import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
// DESIGN-GAP: Budget means 350×1024 bytes, minified browser ESM with dependencies included and no star catalog; subpaths are measured as independent entry points.
const entries = {
  engine: 'packages/engine/src/index.ts',
  common: 'packages/engine/src/common/index.ts',
  bazi: 'packages/engine/src/bazi/index.ts',
  ziwei: 'packages/engine/src/ziwei/index.ts',
  iching: 'packages/engine/src/iching/index.ts',
  qimen: 'packages/engine/src/qimen/index.ts',
  tarot: 'packages/engine/src/tarot/index.ts',
  astrology: 'packages/engine/src/astrology/index.ts',
  vedic: 'packages/engine/src/astrology/vedic.ts',
  daily: 'packages/engine/src/daily/index.ts',
};
const budget = 350 * 1024;
const out = resolve('packages/engine/dist/browser');
await mkdir(out, { recursive: true });
const sizes = [];
for (const [name, entry] of Object.entries(entries)) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minify: true,
    write: false,
    metafile: true,
    logLevel: 'silent',
    outfile: `${name}.js`,
  });
  if (
    Object.values(result.metafile.outputs).some((output) =>
      output.imports.some((item) => item.external),
    )
  )
    throw new Error(`${name}: external runtime import`);
  const file = result.outputFiles[0]!;
  const gzip = gzipSync(file.contents).length;
  sizes.push({
    entry: name === 'engine' ? '@tianji/engine' : `@tianji/engine/${name}`,
    bytes: file.contents.length,
    gzipBytes: gzip,
    budgetPassed: gzip <= budget,
  });
  await writeFile(resolve(out, `${name}.js`), file.contents);
}
const report = {
  format: 'esm',
  platform: 'browser',
  minified: true,
  includesDependencies: true,
  excludesStarCatalog: true,
  budgetBytes: budget,
  strategy: sizes[0]!.budgetPassed ? 'root-with-subpath-exports' : 'per-system-subpath-exports',
  entries: sizes,
};
await writeFile('packages/engine/bundle-report.json', `${JSON.stringify(report, null, 2)}\n`);
for (const entry of sizes)
  process.stdout.write(
    `${entry.entry}: ${(entry.gzipBytes / 1024).toFixed(2)} KiB gzip (${entry.bytes} bytes ESM)\n`,
  );
if (sizes.slice(1).some((entry) => !entry.budgetPassed))
  throw new Error('A system subpath exceeds the browser gzip budget');
