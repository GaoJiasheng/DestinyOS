import { TAROT_CARDS, TarotChartSchema, type CardKey } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import { computeTarot, detectTarotCombinations, TAROT_COMBINATIONS, tarotStatistics } from '../src';
import { drawn, seed } from './tarot-fixtures';

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
