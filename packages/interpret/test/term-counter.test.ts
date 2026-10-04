import { describe, expect, it } from 'vitest';
import { createTermCounter, termCount, termMarker } from '../src';
import type { GlossaryEntry } from '@tianji/content';

const glossary: GlossaryEntry[] = [
  {
    key: 'day_master',
    system: 'bazi',
    aliases: ['日元', 'Day Stem'],
    zh: { term: '日主', short: '代表自己的日干', long: '代表自己的出生日期天干。' },
    en: { term: 'Day Master', short: 'Your day stem', long: 'The stem representing you.' },
  },
  {
    key: 'element.wood',
    system: 'common',
    aliases: [],
    zh: { term: '木', short: '生长', long: '五行中的生长意象。' },
    en: { term: 'Wood', short: 'Growth', long: 'An elemental image of growth.' },
  },
];

describe('report-scoped glossary matcher', () => {
  it('preserves boundaries, expanded markers, repeated matches and locale isolation', () => {
    for (const locale of ['zh', 'en'] as const) {
      const count = createTermCounter(glossary, locale);
      const texts = [
        '自己与例子',
        'Wood Hollywood Wood',
        '日主与日主',
        '[[term:day_master]]',
        '',
        'Wood!',
      ];
      for (const text of texts) {
        expect(count(text)).toBe(termCount(text, glossary, locale));
        expect(count(text)).toBe(termCount(text, glossary, locale));
        expect(count(termMarker(glossary, locale)(text))).toBe(count(text));
      }
    }
    expect(createTermCounter([], 'en')('Wood')).toBe(0);
    expect(createTermCounter(glossary, 'en')('Wood Hollywood Wood')).toBe(2);
    expect(createTermCounter(glossary, 'zh')('树木，木。日元，日主。')).toBe(3);
  });
});
