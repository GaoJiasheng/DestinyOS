import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { z } from 'zod';
import {
  storeRoot,
  evidenceRoot,
  locales,
  sizes,
  scenes,
  limits,
  metadataSchema,
  characters,
} from './store-spec';

const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const screenshotManifest = z.object({
  captures: z.array(
    z.object({
      file: z.string(),
      source: z.string(),
      sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      width: z.number().int(),
      height: z.number().int(),
    }),
  ),
});
const buildSchema = z.object({
  configuration: z.literal('Release'),
  appVariant: z.literal('production'),
  bundleId: z.literal('pub.gavin.tianji'),
  devRoutesEnabled: z.literal(false),
  auditEnabled: z.literal(false),
  mockIdentity: z.literal(false),
  appVersion: z.literal('1.0.0'),
  executableSha256: z.string().regex(/^[a-f0-9]{64}$/),
  bundleSha256: z.string().regex(/^[a-f0-9]{64}$/),
  devices: z.object({
    '6.9': z.object({ udid: z.string(), model: z.literal('iPhone 16 Pro Max') }),
    '6.5': z.object({ udid: z.string(), model: z.literal('iPhone 14 Plus') }),
  }),
});
const fieldSchema = z.object({
  value: z.string().min(1),
  characters: z.number().int(),
  limit: z.number().int(),
});
/** Validate values rather than trusting exported counts; keywords may not repeat title words. */
export function checkMetadata(input: unknown): void {
  const parsed = metadataSchema.parse(input);
  for (const [key, limit] of Object.entries(limits)) {
    const field = fieldSchema.parse(parsed.fields[key]);
    if (
      field.value !== field.value.normalize('NFC') ||
      characters(field.value) > limit ||
      field.characters !== characters(field.value) ||
      field.limit !== limit
    )
      throw new Error(`Invalid ${parsed.locale}/${key} character count or limit`);
    if (key.endsWith('Url')) {
      const url = new URL(field.value);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'tianji.gavin.pub' ||
        url.search ||
        url.hash
      )
        throw new Error(`Invalid public URL: ${key}`);
    }
  }
  const title = fieldSchema.parse(parsed.fields.name).value;
  if (parsed.locale === 'en-US' && title !== 'DestinyOS: BaZi & Tarot')
    throw new Error('English name differs from approved ASC name');
  const keywords = fieldSchema
    .parse(parsed.fields.keywords)
    .value.split(',')
    .map((k) => k.trim().toLocaleLowerCase('en-US'));
  if (keywords.some((k) => !k) || new Set(keywords).size !== keywords.length)
    throw new Error('Empty or duplicate keyword');
  const titleWords = title
    .toLocaleLowerCase('en-US')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  for (const keyword of keywords) {
    if (
      parsed.locale === 'en-US'
        ? keyword.split(/\s+/).some((word) => titleWords.includes(word))
        : title.includes(keyword)
    )
      throw new Error(`Keyword repeats name: ${keyword}`);
  }
  if (
    parsed.nameCandidates.length !== (parsed.locale === 'en-US' ? 1 : 3) ||
    parsed.nameCandidates.filter((c) => c.preferred).length !== 1 ||
    parsed.nameCandidates[0]?.value !== title ||
    !parsed.nameCandidates[0]?.preferred
  )
    throw new Error('Missing name candidates or preferred name');
  for (const c of parsed.nameCandidates)
    if (c.characters !== characters(c.value) || c.characters > 30)
      throw new Error('Invalid candidate character count');
}
async function json(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}
/** Check one PNG's native dimensions and opaque RGB output. */
async function checkPng(file: string, width: number, height: number) {
  const info = await sharp(file).metadata();
  if (info.format !== 'png' || info.width !== width || info.height !== height || info.hasAlpha)
    throw new Error(`Invalid PNG dimensions/alpha: ${file}`);
}
/** Validate all localized files and capture provenance; full mode also requires genuine IAP evidence and no submission blockers. */
export async function checkStore(assetsOnly = false): Promise<void> {
  for (const name of [
    'README.md',
    'privacy-answers.md',
    'review-notes.md',
    'submission-status.json',
    'url-checks.json',
    'automation/prepare.yaml',
    'automation/capture.yaml',
    'automation/today.yaml',
    'automation/systems.yaml',
    'automation/profile-label.yaml',
  ])
    await access(path.join(storeRoot, name));
  const build = buildSchema.parse(await json(path.join(evidenceRoot, 'build.json')));
  if (new Set(Object.values(build.devices).map((d) => d.udid)).size !== 2)
    throw new Error('Capture devices must be distinct');
  const manifest = screenshotManifest.parse(await json(path.join(storeRoot, 'screenshots.json')));
  for (const locale of locales) {
    checkMetadata(await json(path.join(storeRoot, `metadata/${locale}.json`)));
    await access(path.join(storeRoot, `metadata/${locale}.md`));
    const sourceCopy = z
      .record(z.string())
      .parse(await json(path.join(storeRoot, `copy/${locale}.json`)));
    const exported = metadataSchema.parse(
      await json(path.join(storeRoot, `metadata/${locale}.json`)),
    );
    for (const key of Object.keys(limits)) {
      if (fieldSchema.parse(exported.fields[key]).value !== sourceCopy[key])
        throw new Error(`Export differs from next-intl source: ${locale}/${key}`);
    }
    for (const [size, [width, height]] of Object.entries(sizes)) {
      const directory = path.join(storeRoot, `screenshots/${locale}/${size}`);
      const files = (await readdir(directory)).filter((f) => f.endsWith('.png'));
      if (files.length !== scenes.length) throw new Error(`Expected six screenshots: ${directory}`);
      for (const [i, scene] of scenes.entries()) {
        const filename = `${String(i + 1).padStart(2, '0')}-${scene}.png`;
        const file = `screenshots/${locale}/${size}/${filename}`,
          source = `raw/${locale}/${size}/${filename}`;
        const matching = manifest.captures.filter((c) => c.file === file);
        const entry = matching[0];
        if (
          matching.length !== 1 ||
          !entry ||
          entry.source !== source ||
          entry.width !== width ||
          entry.height !== height
        )
          throw new Error(`Missing provenance: ${file}`);
        await checkPng(path.join(storeRoot, file), width, height);
        const raw = await readFile(path.join(evidenceRoot, source));
        const rawInfo = await sharp(raw).metadata();
        if (
          rawInfo.width !== width ||
          rawInfo.height !== height ||
          hash(raw) !== entry.sourceSha256 ||
          hash(await readFile(path.join(storeRoot, file))) !== entry.sha256
        )
          throw new Error(`Capture hash/size mismatch: ${file}`);
      }
    }
  }
  if (manifest.captures.length !== 36) throw new Error('Unexpected capture count');
  if (!assetsOnly) {
    // DESIGN-GAP: Full validation fails closed on unavailable purchase proof; assets-only is an explicit local QA mode, never a submission-ready claim.
    for (const file of ['01-membership.png', '02-purchase-confirmation.png']) {
      const full = path.join(storeRoot, 'screenshots/en-US/iap-review', file);
      const info = await sharp(full).metadata();
      if (info.width !== 1290 || !info.height || info.format !== 'png' || info.hasAlpha)
        throw new Error(`Invalid IAP review screenshot: ${file}`);
    }
    const status = z
      .object({ readyForSubmission: z.literal(true), blockers: z.array(z.string()).length(0) })
      .parse(await json(path.join(storeRoot, 'submission-status.json')));
    if (!status.readyForSubmission) throw new Error('Submission is pending');
  }
  console.log(
    assetsOnly
      ? 'PASS: localized metadata and 36 Release screenshots. Submission readiness NOT asserted.'
      : 'PASS: complete submission package.',
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await checkStore(process.argv.includes('--assets-only'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Store validation failed');
    process.exitCode = 1;
  }
}
