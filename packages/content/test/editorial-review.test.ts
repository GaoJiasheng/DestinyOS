import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { Nakshatra } from '@tianji/shared';
import { evaluateWhen, type KnowledgeUnit } from '../src';
import { root } from '../scripts/load';

async function units(file: string): Promise<KnowledgeUnit[]> {
  const data: unknown = parse(await readFile(`${root}/${file}`, 'utf8'));
  if (!Array.isArray(data)) throw new Error('Expected a KU array');
  // Source shape and bilingual lengths are checked independently by content:validate.
  return data as KnowledgeUnit[];
}

const scoped = (
  await Promise.all(['qimen/deities.yaml', 'qimen/flags.yaml', 'qimen/patterns.yaml'].map(units))
).flat();
const relationships = (await units('bazi/branch-relations.yaml')).filter(
  (unit) => unit.section === 'love',
);
const aspects = await units('astrology/major-aspects.yaml');
const lunarSectors = await units('vedic/moon-nakshatra.yaml');

// DESIGN-GAP: Docs §05.7 specifies path validity and coverage but no relevance
// counterexamples; these tests isolate irrelevant palaces and split relation records.
describe('professional editorial evidence boundaries', () => {
  it.each(scoped)('$id only interprets a symbol in a selected indicator palace', (unit) => {
    const key = unit.id.split('.').at(-1)!;
    const symbol = unit.id.includes('.deities.')
      ? { deity: key }
      : unit.id.includes('.flags.')
        ? { flags: [key] }
        : { patterns: [key] };
    const palaces = [
      { index: 1, flags: [], patterns: [], deity: null },
      { index: 2, ...symbol },
    ];
    expect(evaluateWhen({ palaces, useGods: [{ palaceIndex: 1 }] }, unit.when).matched).toBe(false);
    expect(evaluateWhen({ palaces, useGods: [{ palaceIndex: 2 }] }, unit.when).matched).toBe(true);
    expect(evaluateWhen({ palaces, useGods: [] }, unit.when).matched).toBe(false);
  });

  it.each(relationships)('$id needs the day branch in the same relationship', (unit) => {
    const type = unit.id.split('.')[2]!;
    const chart = {
      relations: {
        branches: [
          { type, pillars: ['year', 'month'] },
          { type: 'unrelated', pillars: ['day', 'hour'] },
        ],
      },
    };
    expect(evaluateWhen(chart, unit.when).matched).toBe(false);
    chart.relations.branches[0]!.pillars = ['day', 'month'];
    expect(evaluateWhen(chart, unit.when).matched).toBe(true);
  });

  it('does not assemble a Sun–Moon square from different aspect records', () => {
    const unit = aspects.find((entry) => entry.id === 'astrology.aspect.sun_moon.square')!;
    expect(
      evaluateWhen(
        {
          aspects: [
            { a: 'sun', b: 'venus', type: 'square', major: true },
            { a: 'mars', b: 'moon', type: 'square', major: true },
          ],
        },
        unit.when,
      ).matched,
    ).toBe(false);
    expect(
      evaluateWhen({ aspects: [{ a: 'moon', b: 'sun', type: 'square', major: true }] }, unit.when)
        .matched,
    ).toBe(true);
  });

  it('keeps all 27 sector rulers consistent across four quarters and both variants', () => {
    // Docs astrology §4.8: Vimshottari order repeats every nine lunar sectors.
    const rulers = [
      'Ketu',
      '(?:Shukra — Venus|Venus)',
      '(?:Surya — the Sun|Surya — Sun|Sun)',
      '(?:Chandra — the Moon|Chandra — Moon|Moon)',
      '(?:Mangala — Mars|Mars)',
      'Rahu',
      '(?:Guru — Jupiter|Jupiter)',
      '(?:Shani — Saturn|Saturn)',
      '(?:Budha — Mercury|Mercury)',
    ];
    for (const [index, sector] of Nakshatra.entries()) {
      const variants = lunarSectors.filter((unit) => unit.id.startsWith(`vedic.moon.${sector}.`));
      expect(variants).toHaveLength(8);
      for (const unit of variants) {
        expect(unit.en.body).toMatch(
          new RegExp(`(?:period ruler is|ruled by) ${rulers[index % 9]}`),
        );
      }
    }
  });
});
