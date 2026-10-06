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
  it('distinguishes named hexagrams from ordinary English verbs without losing explicit references', () => {
    const entries: GlossaryEntry[] = ['Approach', 'Progress', 'Waiting', 'Return'].map(
      (term, i) => ({
        key: `hexagram.${i + 1}`,
        system: 'iching',
        aliases: [],
        zh: { term: '卦', short: '卦名', long: '卦名解释。' },
        en: { term, short: 'A hexagram', long: 'A named hexagram.' },
      }),
    );
    const text = 'You can approach this reading, review progress while waiting and return to it.';
    expect(termMarker(entries, 'en')(text)).toBe(text);
    expect(createTermCounter(entries, 'en')(text)).toBe(0);
    expect(termMarker(entries, 'en')('Approach is named; [[term:hexagram.3]] is explicit.')).toBe(
      '[[term:hexagram.1]] is named; [[term:hexagram.3]] is explicit.',
    );
    expect(createTermCounter(entries, 'en')('Approach and [[term:hexagram.3]].')).toBe(2);
  });
  it('requires explicit references for homographs and prefers the complete Dun alias', () => {
    const entries: GlossaryEntry[] = [
      ...glossary,
      ...(['branch.yin', 'yin'] as const).map((key) => ({
        key,
        system: 'common' as const,
        aliases: [],
        zh: { term: key === 'yin' ? '阴' : '寅', short: '术语解释', long: '术语解释。' },
        en: { term: 'Yin', short: 'A technical term', long: 'A contextual technical term.' },
      })),
      {
        key: 'dun.yin',
        system: 'qimen',
        aliases: ['Yin Dun'],
        zh: { term: '阴遁', short: '奇门排局方向', long: '奇门的排局方向。' },
        en: { term: 'Yin Escape', short: 'Formation direction', long: 'The formation direction.' },
      },
    ];
    expect(termMarker(entries, 'en')('Yin Dun, Yin, [[term:branch.yin]], [[term:yin]].')).toBe(
      '[[term:dun.yin]], Yin, [[term:branch.yin]], [[term:yin]].',
    );
    expect(
      createTermCounter(entries, 'en')('Yin Dun, Yin, [[term:branch.yin]], [[term:yin]].'),
    ).toBe(3);
  });
  it('leaves English pronouns intact while preserving explicit references to the You branch', () => {
    const entries: GlossaryEntry[] = [
      ...glossary,
      {
        key: 'branch.you',
        system: 'common',
        aliases: [],
        zh: { term: '酉', short: '十二地支之一', long: '十二地支之一。' },
        en: { term: 'You', short: 'An Earthly Branch', long: 'One of twelve Earthly Branches.' },
      },
    ];
    const mark = termMarker(entries, 'en');
    expect(mark('You can compare Wood with [[term:branch.you]].')).toBe(
      'You can compare [[term:element.wood]] with [[term:branch.you]].',
    );
    const count = createTermCounter(entries, 'en');
    expect(count('You can choose what works for you.')).toBe(0);
    expect(count('You can compare Wood with [[term:branch.you]].')).toBe(2);
    expect(termMarker(entries, 'zh')('酉，自己。')).toBe('[[term:branch.you]]，自己。');
  });
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

it('preserves Unicode boundaries and longest phrases with factored English alternatives', () => {
  const entries: GlossaryEntry[] = [
    ...glossary,
    {
      ...glossary[0]!,
      key: 'wood_phrase',
      aliases: [],
      en: { term: 'Wood Element', short: 'Phrase', long: 'Phrase.' },
    },
  ];
  const text = '汉Wood éWood 𝟘Wood Wood𝟘 𝄞Wood WOOD Wood Element.';
  expect(createTermCounter(entries, 'en')(text)).toBe(3);
  expect(termMarker(entries, 'en')(text)).toBe(
    '汉Wood éWood 𝟘Wood Wood𝟘 𝄞[[term:element.wood]] WOOD [[term:wood_phrase]].',
  );
});
