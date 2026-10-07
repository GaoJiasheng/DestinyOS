import { describe, expect, it } from 'vitest';
import { createTermCounter, termCount, termMarker, termPattern } from '../src';
import type { GlossaryEntry } from '@tianji/content';
import { loadContent } from '../../content/scripts/load';
import { localeText } from '@tianji/shared/locale';
import { systemConfigs } from '../src';

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

it('keeps Chinese compound priority and standalone boundaries when sharing a matcher', () => {
  const entries: GlossaryEntry[] = [
    ...glossary,
    {
      ...glossary[1]!,
      key: 'wood_compound',
      zh: { term: '木星', short: '行星', long: '行星的中文名称。' },
    },
  ];
  const matcher = termPattern(entries, 'zh');
  const count = createTermCounter(entries, 'zh', matcher);
  const mark = termMarker(entries, 'zh', matcher);
  const text = '树木 木 木星 𝄞木！木𝟘 木木。日主，日元。';
  expect(count(text)).toBe(6);
  const marked = mark(text);
  expect(marked).toBe(
    '树木 [[term:element.wood]] [[term:wood_compound]] 𝄞木！木𝟘 木木。[[term:day_master]]，日元。',
  );
  expect(count(marked)).toBe(6);
  expect(count(text)).toBe(6);
  expect(mark('木星 木 日元')).toBe('木星 木 日元');
});

it('preserves the flat matcher across the complete bilingual corpus and traditional aliases', async () => {
  const content = await loadContent();
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const system of Object.keys(systemConfigs))
    for (const locale of ['zh', 'en', 'zh-TW'] as const) {
      const entries = content.glossary.filter(
        (entry) => entry.system === system || entry.system === 'common',
      );
      const matcher = termPattern(entries, locale);
      const spellings = [...matcher.unique.keys()];
      const standalone = locale === 'en' ? [] : spellings.filter((term) => [...term].length === 1);
      const flat = [
        spellings
          .filter((term) => locale === 'en' || [...term].length !== 1)
          .map(escape)
          .join('|'),
        standalone.length
          ? `(?<![\\p{Script=Han}])(?:${standalone.map(escape).join('|')})(?![\\p{Script=Han}])`
          : '',
      ]
        .filter(Boolean)
        .join('|');
      const reference = new RegExp(
        locale === 'en' ? `(?<![\\p{L}\\p{N}_])(?:${flat})(?![\\p{L}\\p{N}_])` : flat,
        'giu',
      );
      const source = locale === 'en' ? 'en' : 'zh';
      const prose = localeText(
        content.units
          .filter((unit) => unit.system === system || unit.system === 'common')
          .map((unit) => unit[source].body)
          .join('\n'),
        locale,
      );
      const text =
        prose +
        '\n' +
        spellings.join(' · ') +
        '\n' +
        spellings.map((term) => `x${term}𝟘`).join(' ');
      expect(
        [...text.matchAll(matcher.regex!)].map((match) => [match.index, match[0]]),
        `${system}/${locale}`,
      ).toEqual([...text.matchAll(reference)].map((match) => [match.index, match[0]]));
    }
});

it('keeps literal punctuation, Unicode code points and longer descendants ahead of terminal prefixes', () => {
  const entries: GlossaryEntry[] = ['Sky', 'Sky Stone', 'Sky Star', 'C++', 'C+', '𝄞Sky'].map(
    (term, index) => ({
      ...glossary[0]!,
      key: `literal.${index}`,
      aliases: [],
      en: { term, short: 'Term', long: 'Term.' },
    }),
  );
  expect(termMarker(entries, 'en')('Sky Star, Sky Stone, Sky, C++, C+, 𝄞Sky.')).toBe(
    '[[term:literal.2]], [[term:literal.1]], [[term:literal.0]], [[term:literal.3]], [[term:literal.4]], [[term:literal.5]].',
  );
  const equivalent = ['σxxxyyyyy', 'ςx-y', 'σx', 'ıx-y', 'ix'].map((term, index) => ({
    ...glossary[0]!,
    key: `fold.${index}`,
    aliases: [],
    en: { term, short: 'Term', long: 'Term.' },
  }));
  expect(
    [...'σx-y ıx-y ix'.matchAll(termPattern(equivalent, 'en').regex!)].map((match) => match[0]),
  ).toEqual(['σx-y', 'ıx-y', 'ix']);
});
