import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { TAROT_CARDS } from '../packages/shared/src/constants/tarot-cards';
import { brand } from '../packages/shared/src/brand';
const output = 'apps/web/public/tarot/rws';
const cache = '/tmp/destinyos-rws1909';
const infoSchema = z.object({
  query: z.object({
    pages: z.record(
      z.object({
        title: z.string(),
        imageinfo: z.array(
          z.object({
            url: z.string().url(),
            descriptionurl: z.string().url(),
            extmetadata: z.record(
              z.object({ value: z.union([z.string(), z.number()]) }).passthrough(),
            ),
          }),
        ),
      }),
    ),
  }),
});
const agent = `${brand.nameEn}/1.0 (https://${brand.domain}; public-domain tarot asset build)`;
async function download(url: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': agent } });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 4) throw new Error(`HTTP ${response.status}: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
  }
  throw new Error('Download exhausted');
}
/** Build the complete verified 1909 deck; --verify checks checked-in resources without network. */
async function main() {
  if (process.argv.includes('--verify')) {
    const manifest = z
      .array(
        z.object({
          key: z.string(),
          webpSha256: z.string().regex(/^[a-f0-9]{64}$/),
          license: z.literal('Public domain'),
          date: z.string().includes('1909'),
          descriptionUrl: z.string().url(),
        }),
      )
      .parse(JSON.parse(await readFile(`${output}/sources.json`, 'utf8')));
    if (manifest.length !== 78 || new Set(manifest.map((m) => m.key)).size !== 78)
      throw new Error('Incomplete provenance');
    for (const card of TAROT_CARDS) {
      const file = await readFile(`${output}/${card.key}.webp`);
      const metadata = await sharp(file).metadata();
      if (metadata.width !== 343 || metadata.height !== 600 || file.length > 40_000)
        throw new Error(`Invalid asset: ${card.key}`);
      if (
        createHash('sha256').update(file).digest('hex') !==
        manifest.find((m) => m.key === card.key)?.webpSha256
      )
        throw new Error(`Hash mismatch: ${card.key}`);
    }
    console.log('Verified 78 public-domain assets: 343×600 WebP, each ≤40 KB.');
    return;
  }
  await mkdir(output, { recursive: true });
  await mkdir(cache, { recursive: true });
  const records: Array<Record<string, string>> = [];
  for (let start = 0; start < TAROT_CARDS.length; start += 39) {
    const cards = TAROT_CARDS.slice(start, start + 39);
    const titles = cards.map((card) => {
      const suffix =
        card.arcana === 'major'
          ? `${String(card.number).padStart(2, '0')}_${card.key
              .slice(9)
              .split('_')
              .map((s) => (s === 'of' ? s : s[0]!.toUpperCase() + s.slice(1)))
              .join('_')}`
          : `${card.suit![0]!.toUpperCase()}${card.suit!.slice(1)}_${String(card.number).padStart(2, '0')}`;
      return `File:RWS1909_-_${suffix}.jpeg`;
    });
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      titles: titles.join('|'),
    }).toString();
    const data = infoSchema.parse(JSON.parse((await download(url.href)).toString()));
    for (const [index, card] of cards.entries()) {
      const page = Object.values(data.query.pages).find(
        (p) => p.title.replaceAll(' ', '_') === titles[index],
      );
      const info = page?.imageinfo[0];
      if (!info) throw new Error(`Missing source: ${titles[index]}`);
      const license = String(info.extmetadata.LicenseShortName?.value ?? '');
      const date = String(info.extmetadata.DateTimeOriginal?.value ?? '');
      const artist = String(info.extmetadata.Artist?.value ?? '').replace(/<[^>]*>/g, '');
      if (
        license !== 'Public domain' ||
        !date.includes('1909') ||
        !artist.includes('Pamela Colman Smith')
      )
        throw new Error(`Unverified 1909/public-domain source: ${card.key}`);
      const sourceUrl = new URL(info.url);
      sourceUrl.search = '';
      const cached = `${cache}/${card.key}.jpeg`;
      const source = await readFile(cached).catch(async () => {
        const bytes = await download(sourceUrl.href);
        await writeFile(cached, bytes);
        return bytes;
      });
      // DESIGN-GAP: 600px at 2:3.5 needs a fractional width; 343px is the nearest integer. Centre cropping preserves the illustration.
      let quality = 80;
      let webp = await sharp(source)
        .resize(343, 600, { fit: 'cover', position: 'centre' })
        .webp({ quality })
        .toBuffer();
      while (webp.length > 40_000 && quality > 30) {
        quality -= 5;
        webp = await sharp(source).resize(343, 600, { fit: 'cover' }).webp({ quality }).toBuffer();
      }
      if (webp.length > 40_000) throw new Error(`Image budget exceeded: ${card.key}`);
      await writeFile(`${output}/${card.key}.webp`, webp);
      records.push({
        key: card.key,
        file: page!.title,
        sourceUrl: sourceUrl.href,
        descriptionUrl: info.descriptionurl,
        license,
        artist,
        licenseUrl: String(
          info.extmetadata.LicenseUrl?.value ??
            'https://creativecommons.org/publicdomain/mark/1.0/',
        ),
        date,
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        webpSha256: createHash('sha256').update(webp).digest('hex'),
      });
      console.log(`Built ${records.length}/78 ${card.key}`);
    }
  }
  await writeFile(`${output}/sources.json`, JSON.stringify(records, null, 2) + '\n');
  await writeFile(
    `${output}/ATTRIBUTION.md`,
    `# Rider–Waite–Smith tarot: 1909\n\nArt: Pamela Colman Smith (1878–1951). Deck conceived by Arthur Edward Waite.\nOriginal 1909 “Roses & Lilies” deck, scanned by Saskia Jansen from her collection.\nSource: Wikimedia Commons. Each file's imageinfo identifies 1909 and Public domain.\nCommons marks these works PD-old-70-expired and public domain in the US (published before 1931).\nPublic Domain Mark: https://creativecommons.org/publicdomain/mark/1.0/\n\nChanges: centre-cropped to 2:3.5 (rounded to 343×600 pixels), converted to WebP ≤40 KB.\nRebuild: \`pnpm tarot:assets\`; verify: \`pnpm tarot:assets --verify\`.\nPer-file URLs, source SHA-256 and output SHA-256 are in sources.json.\n\n| Local key | Commons source | License |\n|---|---|---|\n${records.map((r) => `| ${r.key} | [${r.file}](${r.descriptionUrl}) | Public domain |`).join('\n')}\n`,
  );
}
await main();
