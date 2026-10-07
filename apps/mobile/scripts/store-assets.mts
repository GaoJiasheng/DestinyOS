import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createTranslator } from 'next-intl';
import { brand } from '@tianji/shared/brand';
import { designTokens } from '@tianji/ui-core/tokens';
const root = fileURLToPath(new URL('../', import.meta.url));
const colors = designTokens.base;
// DESIGN-GAP: Store copy has no prescribed key names; mobile.store.* uses the shared next-intl catalogs and the existing brand configuration.
const locales = ['zh', 'en', 'zh-TW'] as const;
const scenes = ['today', 'bazi', 'astrology', 'tarot', 'calendar', 'learn'] as const;
const sizes = {
  'iphone-6.9': [1320, 2868],
  'iphone-6.5': [1242, 2688],
  'android-phone': [1080, 1920],
} as const;
const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
// DESIGN-GAP: Store decoration is generated from shared visual tokens; full, unaltered simulator screens are fitted inside a plain frame, never a different platform's device shell.
function background(
  width: number,
  height: number,
  title: string,
  detail: string,
  footer: string,
  name: string,
): Buffer {
  const scale = width / 1320;
  const titleLines =
    title.length > 25 ? title.replace(' of symbols', '\nof symbols').split('\n') : [title];
  const stars = Array.from(
    { length: 90 },
    (_, i) =>
      `<circle cx="${(i * 173 + 71) % 1320}" cy="${(i * 263 + 99) % 2868}" r="${i % 4 === 0 ? 2 : 1}" fill="${colors['gold-soft']}" opacity="${i % 3 === 0 ? 0.55 : 0.2}"/>`,
  ).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${colors['bg-0']}"/>
  <g transform="scale(${scale})">${stars}
  <path d="M70 105 H220 M1100 105 H1250" stroke="${colors.gold}"/>
  <text x="660" y="120" text-anchor="middle" fill="${colors.gold}" font-size="40" font-family="Inter, sans-serif">${escape(name)}</text>
  ${titleLines.map((line, i) => `<text x="660" y="${255 + i * 78}" text-anchor="middle" fill="${colors['text-1']}" font-size="${title.length > 25 ? 66 : 76}" font-family="Noto Serif CJK SC, PingFang SC, serif">${escape(line)}</text>`).join('')}
  <text x="660" y="${titleLines.length > 1 ? 405 : 365}" text-anchor="middle" fill="${colors['gold-soft']}" font-size="36" font-family="sans-serif">${escape(detail)}</text>
  </g>
  <text x="${width / 2}" y="${height - 45 * scale}" text-anchor="middle" fill="${colors['text-2']}" font-size="${26 * scale}" font-family="sans-serif">${escape(footer)}</text>
  </svg>`);
}
await mkdir(path.join(root, 'store/metadata'), { recursive: true });
const metadataOnly = process.argv.includes('--metadata-only');
const evidence: { file: string; source: string; sha256: string; width: number; height: number }[] =
  [];
for (const locale of locales) {
  const catalog = JSON.parse(
    await readFile(path.join(root, `../web/messages/${locale}.json`), 'utf8'),
  ) as Record<string, string>;
  const messages = Object.fromEntries(
    Object.entries(catalog)
      .filter(([key]) => key.startsWith('mobile.store.'))
      .map(([key, value]) => [key.replaceAll('.', '_'), value]),
  );
  const translate = createTranslator({ locale, messages });
  const name = locale === 'en' ? brand.nameEn : locale === 'zh-TW' ? brand.nameZhTW : brand.nameZh;
  const t = (key: string) => translate(`mobile_store_${key.replaceAll('.', '_')}`, { brand: name });
  const metadata = Object.fromEntries(
    ['title', 'subtitle', 'description', 'keywords', 'shortDescription'].map((key) => [
      key,
      t(key),
    ]),
  );
  if (
    [...metadata.title!].length > 30 ||
    [...metadata.subtitle!].length > 30 ||
    [...metadata.keywords!].length > 100 ||
    [...metadata.shortDescription!].length > 80 ||
    [...metadata.description!].length > 4000
  )
    throw new Error(`Store limits exceeded: ${locale}`);
  await writeFile(
    path.join(root, `store/metadata/${locale}.json`),
    JSON.stringify(metadata, null, 2) + '\n',
  );
  if (metadataOnly) continue;
  for (const [size, [width, height]] of Object.entries(sizes)) {
    for (const [index, scene] of scenes.entries()) {
      const filename = `${String(index + 1).padStart(2, '0')}-${scene}.png`;
      const source = `test-results/M15/raw/${size}/${locale}/${filename}`;
      let raw: Buffer;
      try {
        raw = await readFile(path.join(root, source));
      } catch (error) {
        if (size === 'android-phone' && (error as NodeJS.ErrnoException).code === 'ENOENT')
          continue;
        throw error;
      }
      const info = await sharp(raw).metadata();
      // DESIGN-GAP: Reject Expo's known full-width refresh banner; recapture the real screen instead of retouching diagnostic overlays.
      const thumbnail = await sharp(raw)
        .resize({ width: 128 })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let y = 0; y < thumbnail.info.height; y++) {
        let blue = 0;
        for (let x = 0; x < thumbnail.info.width; x++) {
          const offset = (y * thumbnail.info.width + x) * thumbnail.info.channels;
          const red = thumbnail.data[offset] ?? 0,
            green = thumbnail.data[offset + 1] ?? 0,
            blueChannel = thumbnail.data[offset + 2] ?? 0;
          if (red > 20 && red < 65 && green > 110 && green < 165 && blueChannel > 200) blue++;
        }
        if (blue / thumbnail.info.width > 0.9)
          throw new Error(`Recapture development overlay: ${source}`);
      }
      // iOS screenshots must originate at the target resolution, not be resized from the other phone class.
      if (size.startsWith('iphone') && (info.width !== width || info.height !== height))
        throw new Error(`Wrong simulator size: ${source}`);
      const scale = width / 1320;
      const top = Math.round(465 * scale),
        bottom = Math.round(110 * scale);
      const maxWidth = Math.round(width * 0.87),
        maxHeight = height - top - bottom;
      const screen = await sharp(raw)
        .resize({ width: maxWidth, height: maxHeight, fit: 'inside' })
        .png()
        .toBuffer();
      const fitted = await sharp(screen).metadata();
      const left = Math.round((width - fitted.width!) / 2);
      const frame = Buffer.from(
        `<svg width="${width}" height="${height}"><rect x="${left - 8}" y="${top - 8}" width="${fitted.width! + 16}" height="${fitted.height! + 16}" rx="28" fill="${colors['surface-2']}" stroke="${colors.gold}" stroke-width="2"/></svg>`,
      );
      const output = `store/screenshots/${size}/${locale}/${filename}`;
      await mkdir(path.dirname(path.join(root, output)), { recursive: true });
      await sharp(
        background(
          width,
          height,
          t(`screen.${scene}.title`),
          t(`screen.${scene}.detail`),
          t('template.footer'),
          name,
        ),
      )
        .composite([{ input: frame }, { input: screen, top, left }])
        .removeAlpha()
        .png()
        .toFile(path.join(root, output));
      evidence.push({
        file: output,
        source,
        sha256: createHash('sha256').update(raw).digest('hex'),
        width,
        height,
      });
    }
  }
}
if (!metadataOnly)
  await writeFile(
    path.join(root, 'test-results/M15/screenshots.json'),
    JSON.stringify(
      {
        captures: evidence,
        android:
          evidence.filter((item) => item.file.includes('android-phone')).length === 18
            ? 'captured'
            : 'pending-owner-java-and-emulator',
      },
      null,
      2,
    ) + '\n',
  );
