import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createTranslator } from 'next-intl';
import sharp from 'sharp';
import { z } from 'zod';
import { brand } from '@tianji/shared/brand';
import { designTokens } from '@tianji/ui-core/tokens';

import {
  storeRoot,
  evidenceRoot,
  locales,
  sizes,
  scenes,
  limits,
  characters,
} from '../../../scripts/store-spec';
const catalogSchema = z.record(z.string());
/** Read all store copy through next-intl without changing the application's message catalogs. */
export async function storeCopy(locale: (typeof locales)[number]) {
  // DESIGN-GAP: Store-only copy uses dedicated next-intl catalogs to keep this files-only task out of shipped application bundles.
  const messages = catalogSchema.parse(
    JSON.parse(await readFile(path.join(storeRoot, `copy/${locale}.json`), 'utf8')) as unknown,
  );
  return createTranslator({ locale, messages });
}
/** Export paste-ready text plus machine-readable character validation. */
async function metadata() {
  for (const locale of locales) {
    const t = await storeCopy(locale);
    const fields = Object.fromEntries(
      Object.entries(limits).map(([key, limit]) => {
        const value = t(key),
          count = characters(value);
        if (count > limit) throw new Error(`${locale}/${key}: ${count} > ${limit}`);
        return [key, { value, characters: count, limit }];
      }),
    );
    const nameCandidates = Array.from({ length: locale === 'en-US' ? 1 : 3 }, (_, i) => {
      const value = t(`nameCandidate${i + 1}`);
      if (characters(value) > 30) throw new Error('Name candidate exceeds 30 characters');
      return { value, characters: characters(value), preferred: i === 0 };
    });
    const result = { locale, primaryLanguage: 'en-US', version: '1.0.0', fields, nameCandidates };
    await mkdir(path.join(storeRoot, 'metadata'), { recursive: true });
    await writeFile(
      path.join(storeRoot, `metadata/${locale}.json`),
      JSON.stringify(result, null, 2) + '\n',
    );
    const text = [
      `# ${locale} · 1.0.0`,
      '',
      '字符数按 Unicode 码点计算；包含空格、标点、逗号、换行。URL 上限采用 ASC 通用 URL 字段上限。',
      '',
      '## 名称候选',
      '',
      ...nameCandidates.map(
        (c) => `- ${c.preferred ? '首选' : '候选'}：${c.value}（${c.characters}/30）`,
      ),
      '',
      ...Object.entries(fields).flatMap(([key, field]) => [
        `## ${key}（${field.characters}/${field.limit}）`,
        '',
        field.value,
        '',
      ]),
    ].join('\n');
    await writeFile(path.join(storeRoot, `metadata/${locale}.md`), text);
  }
}
const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
/** Fit an unmodified Release screenshot inside a gold celestial template; never synthesize UI. */
async function screenshots() {
  const captures = [];
  for (const locale of locales)
    for (const [size, [width, height]] of Object.entries(sizes)) {
      const t = await storeCopy(locale),
        scale = width / 1320;
      for (const [i, scene] of scenes.entries()) {
        const filename = `${String(i + 1).padStart(2, '0')}-${scene}.png`;
        const source = `raw/${locale}/${size}/${filename}`;
        const raw = await readFile(path.join(evidenceRoot, source));
        const info = await sharp(raw).metadata();
        if (info.width !== width || info.height !== height)
          throw new Error(`Wrong capture size: ${source}`);
        const colors = designTokens.base;
        const stars = Array.from(
          { length: 120 },
          (_, n) =>
            `<circle cx="${(n * 173 + 83) % 1320}" cy="${(n * 267 + 70) % 2868}" r="${n % 9 === 0 ? 2.2 : 1.2}" fill="${colors['gold-soft']}" opacity="${n % 3 === 0 ? 0.6 : 0.2}"/>`,
        ).join('');
        // DESIGN-GAP: A shared celestial grid and one-line localized headline frame the complete screen; no device bezel implies a different phone model.
        const background = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="g"><stop stop-color="#172031"/><stop offset="1" stop-color="${colors['bg-0']}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><g transform="scale(${scale})">${stars}<circle cx="660" cy="1510" r="1050" fill="none" stroke="${colors.gold}" opacity="0.16"/><circle cx="660" cy="1510" r="930" fill="none" stroke="${colors.gold}" opacity="0.09"/><path d="M65 112 H250 M1070 112 H1255" stroke="${colors.gold}"/><text x="660" y="126" text-anchor="middle" fill="${colors.gold}" font-size="38" font-family="Inter,sans-serif">${escape(locale === 'en-US' ? brand.nameEn : locale === 'zh-Hant' ? brand.nameZhTW : brand.nameZh)}</text><text x="660" y="255" text-anchor="middle" fill="${colors['text-1']}" font-size="${locale === 'en-US' ? 62 : 70}" font-family="PingFang SC,Noto Serif CJK SC,serif">${escape(t(`screenTitle${i + 1}`))}</text><text x="660" y="348" text-anchor="middle" fill="${colors['gold-soft']}" font-size="34" font-family="PingFang SC,sans-serif">${escape(t(`screenDetail${i + 1}`))}</text></g><text x="${width / 2}" y="${height - 44 * scale}" text-anchor="middle" fill="${colors['text-2']}" font-size="${25 * scale}" font-family="PingFang SC,sans-serif">${escape(t('footer'))}</text></svg>`,
        );
        const top = Math.round(430 * scale);
        const screen = await sharp(raw)
          .resize({
            width: Math.round(width * 0.87),
            height: height - top - Math.round(100 * scale),
            fit: 'inside',
          })
          .png()
          .toBuffer();
        const fitted = await sharp(screen).metadata();
        if (!fitted.width || !fitted.height) throw new Error('Invalid fitted image');
        const left = Math.round((width - fitted.width) / 2);
        const frame = Buffer.from(
          `<svg width="${width}" height="${height}"><rect x="${left - 8}" y="${top - 8}" width="${fitted.width + 16}" height="${fitted.height + 16}" rx="24" fill="${colors['surface-2']}" stroke="${colors.gold}" stroke-width="2"/></svg>`,
        );
        const file = `screenshots/${locale}/${size}/${filename}`;
        await mkdir(path.dirname(path.join(storeRoot, file)), { recursive: true });
        await sharp(background)
          .composite([{ input: frame }, { input: screen, top, left }])
          .removeAlpha()
          .png()
          .toFile(path.join(storeRoot, file));
        captures.push({
          file,
          source,
          sourceSha256: hash(raw),
          sha256: hash(await readFile(path.join(storeRoot, file))),
          width,
          height,
        });
      }
    }
  await writeFile(
    path.join(storeRoot, 'screenshots.json'),
    JSON.stringify({ captures }, null, 2) + '\n',
  );
}
if (process.argv[1]?.endsWith('app-store-assets.mts')) {
  await metadata();
  if (!process.argv.includes('--metadata-only')) await screenshots();
}
