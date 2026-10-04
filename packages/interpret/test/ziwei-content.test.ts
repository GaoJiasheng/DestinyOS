import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { files, root } from '../../content/scripts/load';
import { evaluateWhen } from '../../content/src';
import type { KnowledgeUnit } from '../../content/src';
import { Palace, ZIWEI_MAJOR_STARS } from '@tianji/shared';
import { ZIWEI_PATTERN_RULES } from '@tianji/engine';
import { checkZiweiContent, coverageCharts } from '../../../scripts/ziwei-content-coverage';

const units: KnowledgeUnit[] = [];
for (const file of await files(`${root}/ziwei`, '.yaml')) {
  const value: unknown = parse(await readFile(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error('Expected a validated KU array');
  // The content schema and bilingual constraints are enforced by content:validate.
  units.push(...(value as KnowledgeUnit[]));
}

describe('published Zi Wei corpus', () => {
  it('covers the specified editorial dimensions and two variants per life-star brightness group', () => {
    expect(units).toHaveLength(542);
    const prefix = (key: string) => units.filter((u) => u.id.startsWith(`ziwei.${key}.`));
    expect(prefix('major')).toHaveLength(154);
    for (const palace of Object.values(Palace))
      if (palace !== 'life')
        for (const star of ZIWEI_MAJOR_STARS)
          expect(units.some((u) => u.id === `ziwei.major.${palace}.${star}`)).toBe(true);
    expect(
      prefix('pattern')
        .map((u) => u.id)
        .sort(),
    ).toEqual(ZIWEI_PATTERN_RULES.map((rule) => `ziwei.pattern.${rule.key}`).sort());
    expect(prefix('pair')).toHaveLength(30);
    expect(prefix('aux')).toHaveLength(42);
    expect(prefix('pattern')).toHaveLength(25);
    expect(prefix('empty')).toHaveLength(12);
    expect(prefix('body')).toHaveLength(12);
    expect(prefix('bureau')).toHaveLength(5);
    expect(prefix('fallback')).toHaveLength(9);
    for (const layer of ['natal', 'decadal', 'yearly'])
      expect(prefix(`${layer}.mutagen`)).toHaveLength(48);
    const life = prefix('life');
    expect(life).toHaveLength(56);
    const groups = new Map<string, KnowledgeUnit[]>();
    for (const unit of life) {
      const group = unit.id.replace(/\.[ab]$/, '');
      groups.set(group, [...(groups.get(group) ?? []), unit]);
    }
    expect(groups.size).toBe(28);
    for (const variants of groups.values()) {
      expect(variants.map((u) => u.id.at(-1)).sort()).toEqual(['a', 'b']);
      expect(variants[0]?.when).toEqual(variants[1]?.when);
      expect(variants[0]?.zh.body).not.toBe(variants[1]?.zh.body);
      expect(variants[0]?.en.body).not.toBe(variants[1]?.en.body);
      for (const unit of variants)
        expect(unit.exclusive_with).toEqual(variants.filter((u) => u !== unit).map((u) => u.id));
    }
  });

  it('maps timing transformations to their actual stars, including auxiliary stars, rather than the timing palace', async () => {
    const charts = await coverageCharts(8);
    for (const chart of charts)
      for (const layer of ['decadal', 'yearly'] as const)
        for (const mutagen of ['lu', 'quan', 'ke', 'ji'] as const) {
          const starKey = chart.horoscope[layer].mutagens[mutagen];
          const destination = chart.palaces.find((p) =>
            [...p.majorStars, ...p.minorStars].some((s) => s.key === starKey),
          );
          expect(destination).toBeDefined();
          const hits = units.filter(
            (u) =>
              u.id.startsWith(`ziwei.${layer}.mutagen.`) &&
              u.id.endsWith(`.${mutagen}`) &&
              evaluateWhen(chart, u.when).matched,
          );
          expect(hits.map((u) => u.id)).toEqual([
            `ziwei.${layer}.mutagen.${destination?.key}.${mutagen}`,
          ]);
        }
  });

  it('builds complete bilingual reports from legal births with sufficient length and no unresolved placeholders', async () => {
    const result = await checkZiweiContent(12);
    expect(result.reports).toBe(36);
    expect(Object.values(result.emptyChapters).every((n) => n === 0)).toBe(true);
    expect(result.unreadableReports).toBe(0);
    expect(result.minZhChars).toBeGreaterThanOrEqual(2500);
    expect(result.minEnWords).toBeGreaterThanOrEqual(1800);
    expect(result.maxTermDensity).toBeLessThanOrEqual(6);
  }, 30_000);
});
