import { Temporal } from '@js-temporal/polyfill';
import { TAROT_CARDS, TAROT_SPREADS, TarotChartSchema } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import {
  compute,
  computeTarot,
  createRandom,
  dailyTarotSeed,
  drawDaily,
  hashSeed,
  normalizeBirth,
} from '../src';
import A from './fixtures/birth/A.json';
import goldens from './fixtures/tarot/goldens.json';
import golden from './fixtures/tarot/three-ppf.json';
import { seed } from './tarot-fixtures';

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
