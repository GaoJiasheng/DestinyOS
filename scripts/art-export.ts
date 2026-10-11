import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';

const specSchema = z.object({
  id: z.string(),
  subject: z.string(),
  width: z.number(),
  height: z.number(),
  alpha: z.boolean(),
  prompt: z.string(),
});
const specs = z
  .object({ assets: z.array(specSchema), base: z.string(), variants: z.array(z.string()) })
  .parse(JSON.parse(await readFile('scripts/art-prompts.json', 'utf8')));
const candidates = z
  .array(z.object({ id: z.string(), candidate: z.number(), path: z.string(), prompt: z.string() }))
  .parse(JSON.parse(await readFile('.art-candidates.json', 'utf8')));
const selections = z
  .record(z.object({ candidate: z.number(), reason: z.string().min(1) }))
  .parse(JSON.parse(await readFile('.art-selection.json', 'utf8')));
const directory = 'apps/web/public/art';
const rows = [];
for (const spec of specs.assets) {
  const selection = selections[spec.id];
  if (!selection) throw new Error(`Unreviewed artwork: ${spec.id}`);
  const choices = candidates.filter((item) => item.id === spec.id);
  if (choices.length < 2) throw new Error(`Missing candidate comparison: ${spec.id}`);
  const chosen = choices.find((item) => item.candidate === selection.candidate);
  if (!chosen) throw new Error(`Missing selected artwork: ${spec.id}`);
  const input = await readFile(chosen.path);
  const metadata = await sharp(input).metadata();
  if (spec.alpha && !metadata.hasAlpha) throw new Error(`Missing generated alpha: ${spec.id}`);
  const stem = `${directory}/${spec.id}`;
  await mkdir(dirname(stem), { recursive: true });
  const original = `${directory}/originals/${spec.id}.png`;
  await mkdir(dirname(original), { recursive: true });
  // DESIGN-GAP: The built-in generator chooses native dimensions. Lanczos exports meet the required canvas sizes; native dimensions and source hashes remain in the audit manifest, without claiming native 4K detail.
  const rendered = await sharp(input)
    .resize(spec.width, spec.height, {
      fit: 'contain',
      background: spec.alpha ? '#00000000' : '#05070F',
    })
    .png()
    .toBuffer();
  await writeFile(original, rendered);
  await sharp(rendered)
    .resize(Math.round(spec.width / 2), Math.round(spec.height / 2))
    .png({ compressionLevel: 9 })
    .toFile(`${stem}.png`);
  const derivatives = [];
  for (const [suffix, fraction] of [
    ['', 1],
    ['-medium', 0.5],
    ['-small', 0.25],
  ] as const) {
    const width = Math.round(spec.width * fraction),
      height = Math.round(spec.height * fraction);
    let quality = 86;
    let webp = await sharp(rendered)
      .resize(width, height)
      .webp({ quality, alphaQuality: 90, effort: 6 })
      .toBuffer();
    // DESIGN-GAP: The 512px cloud overlay and full galaxy have a combined 265KB image budget; full cloud exports retain detail for native clients. Onboarding artwork gets 95KB.
    const cap =
      spec.id === 'hero/galaxy'
        ? 200 * 1024
        : spec.id === 'hero/ink-clouds' && suffix === '-small'
          ? 65 * 1024
          : spec.id === 'states/disclaimer' && suffix !== ''
            ? 95 * 1024
            : Number.POSITIVE_INFINITY;
    while (webp.byteLength > cap && quality > 20) {
      quality -= 4;
      webp = await sharp(rendered)
        .resize(width, height)
        .webp({ quality, alphaQuality: 75, effort: 6 })
        .toBuffer();
    }
    if (webp.byteLength > cap) throw new Error(`Image budget exceeded: ${spec.id}`);
    await writeFile(`${stem}${suffix}.webp`, webp);
    derivatives.push({
      file: `${spec.id}${suffix}.webp`,
      width,
      height,
      bytes: webp.byteLength,
      quality,
    });
  }
  rows.push({
    id: spec.id,
    prompt: chosen.prompt,
    candidates: choices.map(({ candidate, path, prompt }) => ({
      candidate,
      file: basename(path),
      prompt,
    })),
    selected: selection.candidate,
    reason: selection.reason,
    width: spec.width,
    height: spec.height,
    alpha: spec.alpha,
    originalPngBytes: rendered.byteLength,
    pngBytes: (await stat(`${stem}.png`)).size,
    source: {
      file: basename(chosen.path),
      width: metadata.width,
      height: metadata.height,
      sha256: createHash('sha256').update(input).digest('hex'),
    },
    derivatives,
  });
}
const calibrationInputs = z
  .array(z.object({ id: z.string(), path: z.string(), prompt: z.string(), reason: z.string() }))
  .parse(JSON.parse(await readFile('.art-calibration.json', 'utf8')));
const calibrations = [];
for (const sample of calibrationInputs) {
  const input = await readFile(sample.path);
  const metadata = await sharp(input).metadata();
  const stem = `${directory}/calibration/${sample.id}`;
  await mkdir(dirname(stem), { recursive: true });
  await mkdir(`${directory}/originals/calibration`, { recursive: true });
  await sharp(input)
    .resize(1536, 1536)
    .png()
    .toFile(`${directory}/originals/calibration/${sample.id}.png`);
  await sharp(input).resize(768, 768).png().toFile(`${stem}.png`);
  await sharp(input).resize(1536, 1536).webp({ quality: 82, effort: 6 }).toFile(`${stem}.webp`);
  calibrations.push({
    id: sample.id,
    prompt: sample.prompt,
    candidates: 1,
    reason: sample.reason,
    width: 1536,
    height: 1536,
    webpBytes: (await stat(`${stem}.webp`)).size,
    pngBytes: (await stat(`${stem}.png`)).size,
    source: {
      file: basename(sample.path),
      width: metadata.width,
      height: metadata.height,
      sha256: createHash('sha256').update(input).digest('hex'),
    },
  });
}
const brand = await readFile(`${directory}/brand/app-icon.webp`);
const derivedBrand = [];
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['maskable-512', 512],
  ['apple-touch-icon', 180],
  ['favicon', 32],
] as const) {
  await sharp(brand).resize(size, size).png().toFile(`${directory}/brand/${name}.png`);
  derivedBrand.push({
    file: `brand/${name}.png`,
    width: size,
    height: size,
    bytes: (await stat(`${directory}/brand/${name}.png`)).size,
    source: 'brand/app-icon',
  });
}
// DESIGN-GAP: PNG-backed ICO avoids an additional image dependency and is supported by current browsers.
const favicon = await readFile(`${directory}/brand/favicon.png`);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(favicon.byteLength, 14);
header.writeUInt32LE(22, 18);
await writeFile(`${directory}/brand/favicon.ico`, Buffer.concat([header, favicon]));
derivedBrand.push({
  file: 'brand/favicon.ico',
  width: 32,
  height: 32,
  bytes: header.byteLength + favicon.byteLength,
  source: 'brand/app-icon',
});
await writeFile(
  `${directory}/manifest.json`,
  JSON.stringify(
    {
      tool: 'built-in image_gen',
      calibrations,
      derivedBrand,
      pngPolicy:
        'Full requested-size PNG originals are local; their total exceeds 30MB, so the repository contains 1x PNG and full-size WebP.',
      assets: rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    assets: rows.length,
    originalPngBytes: rows.reduce((sum, row) => sum + row.originalPngBytes, 0),
    webpBytes: rows.reduce(
      (sum, row) => sum + row.derivatives.reduce((bytes, file) => bytes + file.bytes, 0),
      0,
    ),
  }),
);
