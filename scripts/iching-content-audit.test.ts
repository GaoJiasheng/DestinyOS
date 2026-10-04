import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { readFile } from 'node:fs/promises';
import {
  auditIchingContent,
  checkIchingDimensions,
  randomIchingCharts,
} from './iching-content-audit';
import { loadContent, root } from '../packages/content/scripts/load';
import { validateAsset } from '../packages/content/scripts/assets';
import { System } from '../packages/shared/src';
import { interpret } from '../packages/interpret/src';
import version from '../packages/content/version.json';
import { similarity, trigrams, trigramSimilarity } from '../packages/content/src';

describe('I Ching content production audit', () => {
  it('selects both authored variants across users and stays stable across locales and anonymous runs', async () => {
    const content = await loadContent();
    if (!content.transitions) throw new Error('Missing transitions');
    const knowledge = {
      ...version,
      units: content.units,
      glossary: content.glossary,
      transitions: content.transitions,
    };
    const chart = randomIchingCharts(1)[0]!;
    const choice = (userId: string | undefined, locale: 'zh' | 'en') =>
      interpret({
        system: System.iching,
        chart,
        locale,
        knowledge,
        context: { now: chart.castAt.local, profileHasTime: true, userId },
      }).hits.find((hit) => hit.unitId.startsWith('iching.relation.'))?.unitId;
    const selected = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const userId = `test-user-${index}`;
      const id = choice(userId, 'zh');
      expect(id).toBeDefined();
      expect(choice(userId, 'en')).toBe(id);
      expect(choice(userId, 'zh')).toBe(id);
      selected.add(id!);
    }
    expect(selected.size).toBe(2);
    expect(choice(undefined, 'zh')).toBe(choice(undefined, 'en'));
    expect(choice(undefined, 'zh')).toBe(choice(undefined, 'zh'));
    // DESIGN-GAP: Full merged-corpus validation plus bilingual multi-user reports needs a bounded 60s audit budget under coverage on shared worktree CPUs.
  }, 60_000);
  it('checks schema-backed matrices and detects a missing category variant', async () => {
    const content = await loadContent();
    const units = content.units.filter((u) => u.system === System.iching);
    expect(units).toHaveLength(313);
    expect(checkIchingDimensions(units)).toEqual([]);
    expect(
      checkIchingDimensions(units.filter((u) => u.id !== 'iching.relation.same.health.b')),
    ).toEqual([expect.stringContaining('same')]);
  });
  it('creates deterministic engine charts across both methods and all categories', () => {
    const charts = randomIchingCharts(32);
    expect(randomIchingCharts(32)).toEqual(charts);
    expect(new Set(charts.map((c) => c.category)).size).toBe(8);
    expect(new Set(charts.map((c) => c.method)).size).toBe(2);
  });
  // DESIGN-GAP: Whole-corpus bilingual audits need a bounded 60s allowance under coverage on shared worktree CPUs.
  it('composes real bilingual reports with no empty chapters or readability gaps', async () => {
    const audit = await auditIchingContent(16);
    expect(audit.charts).toBe(23);
    expect(audit.reports).toBe(46);
    expect(Object.values(audit.empty)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(audit.readabilityPassed).toBe(46);
    expect(audit.minimum.zhChars).toBeGreaterThanOrEqual(1200);
    expect(audit.minimum.enWords).toBeGreaterThanOrEqual(900);
  }, 60_000);
  it('rejects missing editorial prose and unsafe guidance while preserving classical originals', async () => {
    const file = 'iching/hexagrams.yaml';
    const data: unknown = parse(await readFile(`${root}/${file}`, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Expected an asset array');
    const row: unknown = data[0];
    if (!row || typeof row !== 'object' || !('meaning' in row)) throw new Error('Missing meaning');
    row.meaning = { zh: '', en: 'guaranteed' };
    expect(validateAsset(file, file, stringify(data))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('Editorial length') }),
        expect.objectContaining({ message: expect.stringContaining('Banned editorial phrase') }),
      ]),
    );
  });
  it('preserves character-based Dice overlap and normalization after caching', () => {
    expect(trigrams('ABC! D')).toEqual(new Set(['abc', 'bcd']));
    expect(trigramSimilarity(new Set(['abc', 'bcd']), new Set(['bcd', 'cde']))).toBe(0.5);
    expect(similarity('Ab C!', 'abc')).toBe(1);
    expect(similarity('你好天机', '好天机缘')).toBe(0.5);
    expect(trigramSimilarity(trigrams(''), trigrams(''))).toBe(1);
  });
});
