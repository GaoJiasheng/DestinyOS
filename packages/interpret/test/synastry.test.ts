import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import type { KnowledgeBundle } from '@tianji/content';
import { computeSynastry, normalizeBirth } from '@tianji/engine';
import { BirthInputSchema } from '@tianji/shared';
import { interpret } from '../src';
import A from '../../engine/test/fixtures/birth/A.json';
import B from '../../engine/test/fixtures/birth/B.json';
it('250 bilingual units produce six readable evidence-backed chapters for timed and unknown births', async () => {
  const knowledge = JSON.parse(
    await readFile('packages/content/dist/synastry.zh.json', 'utf8'),
  ) as KnowledgeBundle;
  expect(knowledge.units.filter((u) => u.system === 'synastry')).toHaveLength(250);
  for (const unknown of [false, true]) {
    const first = normalizeBirth({ ...BirthInputSchema.parse(A), timeUnknown: unknown });
    const chart = computeSynastry(
      first,
      normalizeBirth(BirthInputSchema.parse(B)),
      '2026-10-05T00:00:00Z',
    );
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'synastry',
        chart,
        locale,
        knowledge,
        context: { now: '2026-10-05T00:00:00Z', profileHasTime: !unknown },
      });
      expect(report.sections.filter((s) => s.key !== 'summary_actions').map((s) => s.key)).toEqual([
        'overview',
        'communication',
        'love',
        'values_money',
        'conflict',
        'long_term',
      ]);
      expect(
        report.sections
          .filter((s) => s.key !== 'summary_actions')
          .every((s) => s.blocks.some((b) => b.type === 'paragraph')),
      ).toBe(true);
      expect(report.readability.passed, JSON.stringify(report.readability)).toBe(true);
      expect(report.hits.every((h) => h.evidence.length)).toBe(true);
      expect(report.headline.confidence).toBe(unknown ? 0.65 : 1);
    }
  }
});
