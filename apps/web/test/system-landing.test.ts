import { describe, expect, it, vi } from 'vitest';
import { banned, positioningBanned } from '../../../packages/content/scripts/validation';
import learnPaths from '../lib/learn-paths-generated.json';
import { metadataForPublicPath } from '../lib/public-seo';
import { structuredJson } from '../lib/learn';
import {
  faqJsonLd,
  isLandingSystem,
  landingCopy,
  landingLabels,
  landingSystems,
} from '../lib/system-landing';
import zh from '../messages/zh/landing.json';
import en from '../messages/en/landing.json';
import zhTW from '../messages/zh-TW/landing.json';

vi.mock('@/i18n/get-copy', () => ({ getCopy: async () => (key: string) => key }));

const locales = ['zh', 'zh-TW', 'en'] as const;
const learn = new Set<string>(learnPaths);
/** Collect every leaf string so banned-word scans cannot miss a nested block. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
function containsWord(text: string, word: string, locale: 'zh' | 'en') {
  return locale === 'zh'
    ? text.includes(word)
    : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
}

describe('system landing copy', () => {
  for (const locale of locales)
    for (const system of landingSystems)
      it(`${system} ${locale} has every required block`, () => {
        const copy = landingCopy(locale, system);
        for (const text of [
          copy.name,
          copy.tagline,
          copy.prepare,
          copy.seo.title,
          copy.seo.description,
          copy.sample.caption,
        ])
          expect(text.trim().length).toBeGreaterThan(0);
        expect(copy.tells.length).toBeGreaterThanOrEqual(3);
        expect(copy.tells.length).toBeLessThanOrEqual(4);
        expect(copy.method.length).toBeGreaterThanOrEqual(2);
        expect(copy.method.length).toBeLessThanOrEqual(3);
        expect(copy.sample.cells.length).toBeGreaterThanOrEqual(2);
        expect(copy.sample.notes.length).toBeGreaterThanOrEqual(2);
        for (const note of copy.sample.notes) expect(note.basis.trim().length).toBeGreaterThan(0);
        expect(copy.faq.length).toBeGreaterThanOrEqual(4);
        expect(copy.faq.length).toBeLessThanOrEqual(6);
        expect(copy.more.length).toBeGreaterThanOrEqual(3);
      });

  it('marks samples as samples in every language', () => {
    expect(landingLabels('zh').sampleBadge).toBe('示例');
    expect(landingLabels('zh-TW').sampleBadge).toBe('示例');
    expect(landingLabels('en').sampleBadge).toBe('Sample');
  });

  it('gives every English page a background sentence for readers new to the tradition', () => {
    for (const system of landingSystems)
      expect(landingCopy('en', system).background?.trim().length).toBeGreaterThan(0);
  });

  for (const system of landingSystems)
    it(`${system} builds valid FAQPage JSON-LD`, () => {
      const data = JSON.parse(structuredJson(faqJsonLd(landingCopy('en', system)))) as {
        '@context': string;
        '@type': string;
        mainEntity: {
          '@type': string;
          name: string;
          acceptedAnswer: { '@type': string; text: string };
        }[];
      };
      expect(data['@context']).toBe('https://schema.org');
      expect(data['@type']).toBe('FAQPage');
      expect(data.mainEntity.length).toBeGreaterThanOrEqual(4);
      for (const item of data.mainEntity) {
        expect(item['@type']).toBe('Question');
        expect(item.name.length).toBeGreaterThan(0);
        expect(item.acceptedAnswer['@type']).toBe('Answer');
        expect(item.acceptedAnswer.text.length).toBeGreaterThan(0);
      }
    });

  for (const locale of locales)
    it(`${locale} further-reading links exist`, () => {
      for (const system of landingSystems)
        for (const link of landingCopy(locale, system).more) {
          const root = link.href.split('/')[1] ?? '';
          expect(learn.has(link.href) || isLandingSystem(root), link.href).toBe(true);
          if (isLandingSystem(root)) expect(link.href).toBe(`/${root}`);
        }
    });

  it('keeps zh and zh-TW structurally identical, converting prose but not links', () => {
    expect(zhTW.tarot.name).toBe('塔羅');
    const shape = (value: unknown): unknown =>
      typeof value === 'string'
        ? 'text'
        : Array.isArray(value)
          ? value.map(shape)
          : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
            : value;
    expect(shape(zhTW)).toEqual(shape(zh));
    for (const system of landingSystems)
      expect(landingCopy('zh-TW', system).more.map((l) => l.href)).toEqual(
        landingCopy('zh', system).more.map((l) => l.href),
      );
  });

  it('passes the banned-word and positioning checks', () => {
    const scan = (catalog: unknown, locale: 'zh' | 'en') => {
      const text = strings(catalog).join('\n');
      return [...banned[locale], ...positioningBanned[locale]].filter((word) =>
        containsWord(text, word, locale),
      );
    };
    expect(scan(zh, 'zh')).toEqual([]);
    expect(scan(en, 'en')).toEqual([]);
  });

  it('feeds metadata for all nine system routes', async () => {
    for (const locale of locales)
      for (const system of landingSystems) {
        const meta = await metadataForPublicPath(locale, `/${system}`);
        expect(meta.title).toBe(landingCopy(locale, system).seo.title);
        expect(meta.description).toBe(landingCopy(locale, system).seo.description);
        expect(meta.robots).toEqual({ index: true, follow: true });
      }
  });
});
