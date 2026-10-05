import { TAROT_CARDS, TAROT_SPREADS } from '@tianji/shared';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { Bilingual, contentCardSchemaKeys } from './tarot-fixtures';

describe('78 completed cards and eight spread sources', () => {
  it('has complete bilingual structural data and editorial prose', () => {
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
      meaningUpright: Bilingual;
      meaningReversed: Bilingual;
      imagery: Bilingual;
      advice: Bilingual;
      historySymbolism: Bilingual;
      byCategory: Record<string, Record<string, Bilingual>>;
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
      for (const field of [
        'meaningUpright',
        'meaningReversed',
        'imagery',
        'historySymbolism',
        'advice',
      ] as const)
        for (const locale of ['zh', 'en'] as const)
          expect(card[field][locale].trim().length).toBeGreaterThan(0);
      expect(Object.keys(card.byCategory)).toHaveLength(6);
      for (const category of Object.values(card.byCategory)) {
        expect(Object.keys(category).sort()).toEqual(['reversed', 'upright']);
        for (const orientation of ['upright', 'reversed'])
          for (const locale of ['zh', 'en'] as const)
            expect(category[orientation]![locale].trim().length).toBeGreaterThan(0);
      }
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
        name: Bilingual;
        meaning: Bilingual;
        readingTip: Bilingual;
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
