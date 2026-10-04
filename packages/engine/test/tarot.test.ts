import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { Temporal } from '@js-temporal/polyfill';
import {
  TAROT_CARDS,
  TAROT_SPREADS,
  TarotChartSchema,
  type TarotChart,
  type CardKey,
} from '@tianji/shared';
import {
  compute,
  computeTarot,
  drawDaily,
  dailyTarotSeed,
  tarotStatistics,
  detectTarotCombinations,
  TAROT_COMBINATIONS,
  hashSeed,
  createRandom,
  normalizeBirth,
} from '../src';
import goldens from './fixtures/tarot/goldens.json';
import golden from './fixtures/tarot/three-ppf.json';
import A from './fixtures/birth/A.json';
const seed = 'test-seed-001';
const drawn = (keys: CardKey[], reversed = false): TarotChart['cards'] =>
  keys.map((cardKey, order) => ({ cardKey, position: String(order), order, reversed }));
describe('deterministic draws, input boundaries and browser seed protocol', () => {
  it.each(goldens.cases)('frozen $input.seed / $input.spread', ({ input, expected }) => {
    expect(computeTarot({ ...input, spread: input.spread as keyof typeof TAROT_SPREADS })).toEqual(
      expected,
    );
  });
  it('matches the frozen three_ppf fixture and an independent Fisher–Yates reference', () => {
    const chart = computeTarot({ seed, spread: 'three_ppf', allowReversed: true });
    expect(chart).toEqual(golden);
    const deck = [...TAROT_CARDS],
      rng = createRandom(seed);
    for (let n = 78; n > 1; n--) {
      const index = Math.floor(rng.next() * n),
        last = deck[n - 1]!,
        selected = deck[index]!;
      deck[index] = last;
      deck[n - 1] = selected;
    }
    expect(chart.cards.map((c) => [c.cardKey, c.reversed])).toEqual(
      deck.slice(0, 3).map((c) => [c.key, rng.next() < 0.5]),
    );
  });
  it('hashes pickedIndices into the seed, and selection order matters reproducibly', () => {
    const a = computeTarot({ seed, spread: 'three_ppf', pickedIndices: [0, 5, 77] }),
      b = computeTarot({ seed, spread: 'three_ppf', pickedIndices: [77, 5, 0] });
    expect(a.seed).toBe(hashSeed(seed + '0,5,77'));
    expect(a.cards).not.toEqual(b.cards);
    expect(a).toEqual(computeTarot({ seed, spread: 'three_ppf', pickedIndices: [0, 5, 77] }));
  });
  it.each(Object.keys(TAROT_SPREADS) as (keyof typeof TAROT_SPREADS)[])(
    'draws %s unique cards in documented position order',
    (spread) => {
      for (const allowReversed of [true, false]) {
        const chart = computeTarot({ seed, spread, allowReversed });
        expect(TarotChartSchema.safeParse(chart).success).toBe(true);
        expect(chart.cards.map((c) => c.position)).toEqual(TAROT_SPREADS[spread].map((p) => p.key));
        expect(new Set(chart.cards.map((c) => c.cardKey)).size).toBe(chart.cards.length);
        if (!allowReversed) expect(chart.cards.every((c) => !c.reversed)).toBe(true);
      }
    },
  );
  it('reads the Celtic crossing card upright and includes its statistics', () => {
    for (let n = 0; n < 25; n++) {
      const chart = computeTarot({ seed: String(n), spread: 'celtic_cross' });
      expect(chart.cards[1]!.reversed).toBe(false);
      expect(chart.stats.reversedPct).toBe(chart.cards.filter((c) => c.reversed).length * 10);
    }
  });
  it('keeps questions private and validates the 120-character boundary', () => {
    const question = 'Private relationship concern';
    const chart = computeTarot({ seed, question });
    expect(chart.question).toBe(hashSeed(question));
    expect(JSON.stringify(chart)).not.toContain(question);
    expect(computeTarot({ seed, question: '中'.repeat(120) }).question).toBeDefined();
    expect(() => computeTarot({ seed, question: '中'.repeat(121) })).toThrow(
      expect.objectContaining({ code: 'E_INVALID_INPUT' }),
    );
  });
  it.each([
    { seed: '' },
    { seed, spread: 'bad' },
    { seed, category: 'bad' },
    { seed, allowReversed: 1 },
    { seed, pickedIndices: [] },
    { seed, pickedIndices: [78] },
    { seed, pickedIndices: [-1] },
    { seed, pickedIndices: [0.5] },
    { seed, spread: 'three_ppf', pickedIndices: [0, 0, 1] },
    { seed, unexpected: true },
  ])('rejects malformed draw %j', (input) =>
    expect(() => computeTarot(input as Parameters<typeof computeTarot>[0])).toThrow(
      expect.objectContaining({ code: 'E_INVALID_INPUT' }),
    ),
  );
  it('has balanced reversal and deck coverage over 1000 reproducible seeds', () => {
    const counts = new Map<string, number>();
    let reversals = 0;
    for (let i = 0; i < 1000; i++) {
      const card = drawDaily(`uniform-${i}`);
      counts.set(card.cardKey, (counts.get(card.cardKey) ?? 0) + 1);
      if (card.reversed) reversals++;
    }
    expect(counts.size).toBe(78);
    expect(reversals).toBeGreaterThan(430);
    expect(reversals).toBeLessThan(570);
  });
  it('derives daily seeds for users and anonymous IDs without reading a clock', () => {
    expect(dailyTarotSeed('user-1', '2026-10-04')).toBe(hashSeed('user-1|2026-10-04|daily-tarot'));
    const today = drawDaily(dailyTarotSeed('user-1', '2026-10-04'));
    expect(drawDaily(dailyTarotSeed('user-1', '2026-10-04'))).toEqual(today);
    expect(drawDaily(dailyTarotSeed('user-1', '2026-10-05'))).not.toEqual(today);
    expect(drawDaily(dailyTarotSeed('anon-1', '2026-10-04'))).not.toEqual(today);
    expect(() => dailyTarotSeed('', '2026-10-04')).toThrow();
    expect(() => dailyTarotSeed('user', 'bad')).toThrow();
    expect(() => dailyTarotSeed('user', '2026-02-30')).toThrow();
  });
  it('dispatches real charts with explicit parameters and school metadata', () => {
    const result = compute({
      system: 'tarot',
      seed,
      spread: 'three_ppf',
      category: 'love',
      pickedIndices: [1, 2, 3],
      question: { text: 'private' },
      allowReversed: false,
      now: '2026-10-04T00:00:00Z',
    });
    expect(result.chart).toEqual(
      computeTarot({
        seed,
        spread: 'three_ppf',
        category: 'love',
        pickedIndices: [1, 2, 3],
        question: 'private',
        allowReversed: false,
      }),
    );
    expect(result.input).toBeNull();
    expect(result.meta.schoolUsed).toEqual({ deck: 'rws', allowReversed: false });
    const birth = normalizeBirth(A);
    const ziwei = compute({
      system: 'ziwei',
      birth,
      now: Temporal.Instant.from('2026-10-04T00:00:00Z'),
      options: { school: { useApparentSolarTime: false } },
    });
    expect(ziwei.chart.palaces).toHaveLength(12);
    expect(ziwei.meta.schoolUsed).toMatchObject({
      algorithm: 'default',
      leapMonth: 'split_by_15',
      useApparentSolarTime: false,
    });
    expect(
      compute({
        system: 'ziwei',
        birth: { ...birth, gender: 'unspecified' },
        now: '2026-10-04T00:00:00Z',
      }).meta.schoolUsed.genderLayout,
    ).toBe('male');
    expect(() => compute({ system: 'tarot', now: '2026-10-04T00:00:00Z' })).toThrow();
    expect(() =>
      compute({ system: 'tarot', seed, question: { text: 1 }, now: '2026-10-04T00:00:00Z' }),
    ).toThrow();
    expect(() =>
      compute({ system: 'tarot', seed, question: { unknown: true }, now: '2026-10-04T00:00:00Z' }),
    ).toThrow();
  });
});
describe('statistics, thresholds, 30 pairs and positional dynamics', () => {
  it('counts elements, majors, courts and repeated actual numbers, excluding courts', () => {
    const stats = tarotStatistics(
      drawn(['major_05_hierophant', 'cups_05', 'wands_king', 'cups_queen', 'swords_king']),
    );
    expect(stats).toEqual({
      majorPct: 20,
      elements: { fire: 1, water: 2, earth: 1, air: 1 },
      courtCount: 3,
      reversedPct: 0,
      repeatedNumbers: [5],
      missingElements: [],
    });
    expect(tarotStatistics(drawn(['major_00_fool', 'major_19_sun']))).toMatchObject({
      majorPct: 100,
      repeatedNumbers: [],
      missingElements: ['earth', 'water'],
    });
    expect(tarotStatistics(drawn(['cups_01', 'cups_02', 'cups_03'], true))).toMatchObject({
      dominantElement: 'water',
      reversedPct: 100,
    });
    expect(() => tarotStatistics([])).toThrow();
    expect(() => tarotStatistics(drawn(['invalid' as CardKey]))).toThrow();
  });
  it.each(TAROT_COMBINATIONS)('$key positive, negative and orientation-independent', (rule) => {
    expect(detectTarotCombinations(drawn([...rule.cards]))).toContain(rule.key);
    expect(detectTarotCombinations(drawn([...rule.cards].reverse(), true))).toContain(rule.key);
    expect(detectTarotCombinations(drawn([rule.cards[0]]))).not.toContain(rule.key);
    expect(detectTarotCombinations(drawn([rule.cards[1]]))).not.toContain(rule.key);
    expect(detectTarotCombinations(drawn([rule.cards[0], rule.cards[0]]))).not.toContain(rule.key);
  });
  it('contains exactly thirty unique pairs and tests both sides of all thresholds', () => {
    expect(TAROT_COMBINATIONS).toHaveLength(30);
    expect(new Set(TAROT_COMBINATIONS.map((c) => c.key)).size).toBe(30);
    const observed = new Set<string>();
    let positive = 0,
      negative = 0;
    for (let n = 0; n < 100; n++) {
      const chart = computeTarot({ seed: `stats-${n}`, spread: 'relationship' }),
        stats = chart.stats;
      for (const combo of chart.combos) observed.add(combo);
      expect(chart.combos.includes('major_theme')).toBe(stats.majorPct >= 50);
      expect(chart.combos.includes('court_roles')).toBe(stats.courtCount >= 2);
      expect(chart.combos.includes('reversed_theme')).toBe(stats.reversedPct >= 60);
      if (stats.reversedPct >= 60) positive++;
      else negative++;
      for (const element of ['fire', 'earth', 'air', 'water'] as const) {
        expect(chart.combos.includes(`dominant_${element}`)).toBe(
          stats.dominantElement === element,
        );
        expect(chart.combos.includes(`missing_${element}`)).toBe(
          stats.missingElements.includes(element),
        );
      }
      for (const num of stats.repeatedNumbers) expect(chart.combos).toContain(`repeated_${num}`);
    }
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeGreaterThan(0);
    expect(observed.has('court_roles')).toBe(true);
  });
  it.each(['three_ppf', 'three_sao', 'celtic_cross'] as const)(
    'compares %s first and last cards',
    (spread) => {
      for (let n = 0; n < 20; n++) {
        const chart = computeTarot({ seed: `trend-${n}`, spread }),
          first = chart.cards[0]!,
          last = chart.cards.at(-1)!;
        const prefix = spread === 'celtic_cross' ? 'present_outcome' : 'trend';
        expect(chart.combos.includes(`${prefix}_element_shift`)).toBe(
          TAROT_CARDS.find((c) => c.key === first.cardKey)!.element !==
            TAROT_CARDS.find((c) => c.key === last.cardKey)!.element,
        );
        expect(chart.combos.includes(`${prefix}_orientation_shift`)).toBe(
          first.reversed !== last.reversed,
        );
      }
    },
  );
  it('covers yes/no/maybe and reversal-softened confidence', () => {
    const answers = new Set<string>();
    let reversed = false;
    for (let n = 0; n < 100; n++) {
      const chart = computeTarot({ seed: `yes-${n}`, spread: 'yes_no' });
      answers.add(chart.yesNo!.answer);
      if (chart.cards[0]!.reversed) {
        reversed = true;
        expect(chart.yesNo).toEqual({ answer: 'maybe', confidence: 0.5 });
      } else
        expect(chart.yesNo!.answer).toBe(
          TAROT_CARDS.find((c) => c.key === chart.cards[0]!.cardKey)!.yesNo,
        );
    }
    expect(answers.size).toBe(3);
    expect(reversed).toBe(true);
  });
  it('rejects invalid chart cardinality, duplicates, plaintext, position order, forbidden reversals and yes/no', () => {
    const base = computeTarot({ seed, spread: 'three_ppf' });
    for (const cards of [
      [base.cards[0]!],
      base.cards.map((c, i) => ({ ...c, cardKey: base.cards[0]!.cardKey, order: i })),
      base.cards.map((c) => ({ ...c, order: 100 })),
      base.cards.map((c) => ({ ...c, position: 'bad' })),
    ])
      expect(TarotChartSchema.safeParse({ ...base, cards }).success).toBe(false);
    expect(TarotChartSchema.safeParse({ ...base, question: 'private' }).success).toBe(false);
    expect(
      TarotChartSchema.safeParse({
        ...base,
        allowReversed: false,
        cards: base.cards.map((c) => ({ ...c, reversed: true })),
      }).success,
    ).toBe(false);
    expect(
      TarotChartSchema.safeParse({ ...base, yesNo: { answer: 'yes', confidence: 0.75 } }).success,
    ).toBe(false);
    const celtic = computeTarot({ seed, spread: 'celtic_cross' });
    celtic.cards[1]!.reversed = true;
    expect(TarotChartSchema.safeParse(celtic).success).toBe(false);
  });
});
const bilingual = { zh: '', en: '' };
const contentCardSchemaKeys = [
  'key',
  'number',
  'arcana',
  'suit',
  'element',
  'astrology',
  'numerology',
  'yesNo',
  'name',
  'keywordsUpright',
  'keywordsReversed',
  'meaningUpright',
  'meaningReversed',
  'imagery',
  'advice',
  'byCategory',
];
describe('78 card skeletons and eight spread sources', () => {
  it('has complete bilingual structural data; prose intentionally stays empty until T-23', () => {
    const cards = parse(
      readFileSync('packages/content/tarot/cards.yaml', 'utf8')
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .join('\n'),
    ) as {
      key: string;
      name: { zh: string; en: string };
      keywordsUpright: Record<string, string[]>;
      keywordsReversed: Record<string, string[]>;
      meaningUpright: typeof bilingual;
      meaningReversed: typeof bilingual;
      imagery: typeof bilingual;
      advice: typeof bilingual;
      byCategory: Record<string, Record<string, typeof bilingual>>;
    }[];
    expect(cards).toHaveLength(78);
    expect(new Set(cards.map((c) => c.key)).size).toBe(78);
    expect(cards.map((c) => c.key)).toEqual(TAROT_CARDS.map((c) => c.key));
    expect(TAROT_CARDS.filter((c) => c.arcana === 'major')).toHaveLength(22);
    for (const suit of ['wands', 'cups', 'swords', 'pentacles'])
      expect(TAROT_CARDS.filter((c) => c.suit === suit)).toHaveLength(14);
    for (const card of cards) {
      expect(Object.keys(card).sort()).toEqual(contentCardSchemaKeys.sort());
      for (const locale of ['zh', 'en']) {
        expect(card.name[locale as 'zh' | 'en']).not.toBe('');
        for (const keywords of [card.keywordsUpright[locale]!, card.keywordsReversed[locale]!]) {
          expect(keywords.length).toBeGreaterThanOrEqual(3);
          expect(keywords.length).toBeLessThanOrEqual(5);
          expect(keywords.every((k) => k.length > 0)).toBe(true);
        }
      }
      for (const field of ['meaningUpright', 'meaningReversed', 'imagery', 'advice'] as const)
        expect(card[field]).toEqual(bilingual);
      expect(Object.keys(card.byCategory)).toHaveLength(6);
      for (const category of Object.values(card.byCategory))
        expect(category).toEqual({ upright: bilingual, reversed: bilingual });
    }
  });
  it('matches compiled spread keys/positions/coordinates and provides bilingual reading hints', () => {
    const spreads = parse(
      readFileSync('packages/content/tarot/spreads.yaml', 'utf8')
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .join('\n'),
    ) as {
      key: keyof typeof TAROT_SPREADS;
      name: { zh: string; en: string };
      positions: {
        key: string;
        x: number;
        y: number;
        rotation: number;
        readUpright: boolean;
        name: typeof bilingual;
        meaning: typeof bilingual;
        readingTip: typeof bilingual;
      }[];
    }[];
    expect(spreads).toHaveLength(8);
    for (const spread of spreads) {
      expect(
        spread.positions.map(({ key, x, y, rotation, readUpright }) => ({
          key,
          x,
          y,
          rotation,
          readUpright,
        })),
      ).toEqual(TAROT_SPREADS[spread.key]);
      for (const p of spread.positions) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
        for (const locale of ['zh', 'en'] as const)
          for (const text of [p.name, p.meaning, p.readingTip])
            expect(text[locale].length).toBeGreaterThan(0);
      }
    }
    expect(TAROT_SPREADS.relationship.map((p) => [p.x, p.y])).toEqual([
      [0.25, 0.35],
      [0.75, 0.35],
      [0.5, 0.5],
      [0.5, 0.8],
      [0.5, 0.15],
    ]);
    expect(TAROT_SPREADS.celtic_cross[1]).toMatchObject({ rotation: 90, readUpright: true });
    expect(TAROT_SPREADS.year_ahead).toHaveLength(13);
  });
});
