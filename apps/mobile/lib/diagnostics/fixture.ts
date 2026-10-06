import { compute, computeDaily, normalizeBirth, hashSeed, type ComputeInput } from '@tianji/engine';
import { BaziChartSchema, AstroChartSchema, VedicChartSchema } from '@tianji/shared';
import { interpret, type Report } from '@tianji/interpret';
import type { KnowledgeBundle } from '@tianji/content';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import bazi from '../../../../packages/content/dist/bazi.zh.json';
import ziwei from '../../../../packages/content/dist/ziwei.zh.json';
import iching from '../../../../packages/content/dist/iching.zh.json';
import qimen from '../../../../packages/content/dist/qimen.zh.json';
import tarot from '../../../../packages/content/dist/tarot.zh.json';
import astrology from '../../../../packages/content/dist/astrology.zh.json';
import vedic from '../../../../packages/content/dist/vedic.zh.json';
import daily from '../../../../packages/content/dist/daily.zh.json';
export const systems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'daily',
] as const;
export type FixtureSystem = (typeof systems)[number];
export const knowledge = {
  bazi,
  ziwei,
  iching,
  qimen,
  tarot,
  astrology,
  vedic,
  daily,
} as unknown as Record<FixtureSystem, KnowledgeBundle>;
export const fixtureNow = '2026-10-04T04:00:00Z';
/** Fixture A dispatch uses explicit dates/seeds and production bundled knowledge, without IO. */
export function fixtureChart(system: FixtureSystem) {
  const birth = normalizeBirth(A);
  const input: ComputeInput = { system, birth, now: fixtureNow, seed: 'fixture-A' };
  if (system !== 'daily') return compute(input).chart;
  // DESIGN-GAP: Time the complete uncached daily path, including its three natal prerequisites.
  return computeDaily({
    birth,
    baziChart: BaziChartSchema.parse(
      compute({ ...input, system: 'bazi', options: { yearsAround: 0 } }).chart,
    ),
    astroChart: AstroChartSchema.parse(compute({ ...input, system: 'astrology' }).chart),
    vedicChart: VedicChartSchema.parse(compute({ ...input, system: 'vedic' }).chart),
    date: { local: '2026-10-04', tz: 'Asia/Shanghai' },
    seed: hashSeed('fixture-A|2026-10-04'),
  });
}
/** Run the same engine and bilingual report assembly used by offline native reports. */
export function fixtureReport(system: FixtureSystem, locale: 'zh' | 'en') {
  const start = performance.now();
  const chart = fixtureChart(system);
  const afterChart = performance.now();
  const report = interpret({
    system,
    chart,
    locale,
    knowledge: knowledge[system],
    context: { now: fixtureNow, profileHasTime: true },
  });
  return {
    chart,
    report,
    timing: { computeMs: afterChart - start, interpretMs: performance.now() - afterChart },
  };
}
/** Portable correctness signature; floating point chart differences are tested by schema/reference assertions. */
export function reportSignature(report: Report) {
  return {
    sections: report.sections.map((s) => s.key),
    hits: report.hits.map((h) => h.unitId),
    zhChars: report.readability.zhChars,
    enWords: report.readability.enWords,
    disclaimerKey: report.disclaimerKey,
  };
}
