import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from 'next-intl';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import { renderCard } from '../lib/og-card';
import type { PublicShare } from '../lib/share-projection';
vi.mock('../lib/share-copy', () => ({
  shareCopy: async (locale: 'zh' | 'en') =>
    createTranslator({
      locale,
      messages: toMessages(locale === 'zh' ? zh : en),
    }),
}));
describe('embedded share image artwork', () => {
  for (const locale of ['zh', 'en'] as const)
    for (const format of ['landscape', 'story'] as const) {
      it(`${locale}/${format}: renders native dimensions, documented gold and a legible embedded QR`, async () => {
        const card: PublicShare = {
          locale,
          system: 'bazi',
          template: 'chart',
          revealLevel: 1,
          headline: locale === 'zh' ? '从一个习惯认识自己' : 'Recognize one steady habit',
          keywords: locale === 'zh' ? ['日主', '事业', '感情'] : ['Self', 'Work', 'Connections'],
          scores: { career: 3, wealth: 3, love: 3, health: 3, social: 3 },
          diagram: {
            kind: 'pillars',
            items: ['year', 'month', 'day', 'hour'].map((label) => ({
              label: `bazi.chart.${label}`,
              value: 'bazi.stems.geng|bazi.branches.wu',
            })),
          },
        };
        const image = await renderCard(
          card,
          format,
          `https://example.test/s/0123456789ABCDEFGHIJKL?locale=${locale}`,
        );
        const bytes = Buffer.from(await image.arrayBuffer());
        await mkdir('test-results/polish/reference', { recursive: true });
        await writeFile(`test-results/polish/reference/share-${locale}-${format}.png`, bytes);
        const metadata = await sharp(bytes).metadata();
        const width = format === 'story' ? 1080 : 1200,
          height = format === 'story' ? 1920 : 630;
        expect([metadata.width, metadata.height]).toEqual([width, height]);
        const border = await sharp(bytes)
          .extract({ left: 0, top: 0, width: 1, height: 1 })
          .removeAlpha()
          .raw()
          .toBuffer();
        expect([...border]).toEqual([212, 175, 106]);
        const padding = format === 'story' ? 100 : 48;
        const pixels = await sharp(bytes)
          .extract({
            left: width - 12 - padding - 156,
            top: height - 12 - padding - 156,
            width: 156,
            height: 156,
          })
          .removeAlpha()
          .raw()
          .toBuffer();
        let black = 0,
          white = 0;
        for (let i = 0; i < pixels.length; i += 3) {
          if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) black++;
          if (pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 255) white++;
        }
        expect(black).toBeGreaterThan(1000);
        expect(white).toBeGreaterThan(1000);
      });
    }
});
