import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BirthInputSchema, VedicChartSchema, type VedicChart } from '@tianji/shared';
import { computeVedic, normalizeBirth, ENGINE_VERSION } from '../../engine/src';
import { interpret } from '../../interpret/src';
import type { KnowledgeBundle } from '../src';
import { evaluateWhen } from '../src';
import { loadContent, root } from './load';
import { checkCoverage } from './validation';
import plan from '../../interpret/src/plans/vedic.json';
import version from '../version.json';

export const vedicCoverageNow = '2026-10-04T00:00:00Z';
export const vedicCoverageSeed = 23_026_005;
const places = [
  { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
  { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
  { name: 'Singapore', lat: 1.35, lng: 103.82, tz: 'Asia/Singapore' },
  { name: 'New Delhi', lat: 28.61, lng: 77.21, tz: 'Asia/Kolkata' },
];

/** Compute A–G, legal seeded births, and range boundaries with explicit UTC now. */
export async function vedicCoverageCharts(randomCount = 500): Promise<VedicChart[]> {
  const charts: VedicChart[] = [];
  for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    const value: unknown = JSON.parse(
      await readFile(join(root, '../engine/test/fixtures/birth', `${name}.json`), 'utf8'),
    );
    charts.push(computeVedic(normalizeBirth(BirthInputSchema.parse(value)), vedicCoverageNow));
  }
  // DESIGN-GAP: A fixed seed, five time zones, and 20% unknown clocks make coverage
  // reproducible; month days 1–28 are legal in every sampled Gregorian month.
  let state = vedicCoverageSeed;
  const next = (size: number) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return Math.floor((state / 2 ** 32) * size);
  };
  for (let index = 0; index < randomCount + 2; index++) {
    const boundary = index >= randomCount;
    const birth = BirthInputSchema.parse({
      calendar: 'gregorian',
      year: boundary ? (index === randomCount ? 1900 : 2100) : 1900 + next(127),
      month: boundary ? 1 : 1 + next(12),
      day: boundary ? 1 : 1 + next(28),
      hour: next(24),
      minute: next(60),
      timeUnknown: index % 5 === 0,
      gender: (['male', 'female', 'unspecified'] as const)[next(3)],
      place: places[next(places.length)],
    });
    charts.push(computeVedic(normalizeBirth(birth), vedicCoverageNow));
  }
  return charts.map((chart) => VedicChartSchema.parse(chart));
}

/** Validate sources and audit both locale reports, including post-selection chapter gaps. */
export async function auditVedicCoverage(randomCount = 500) {
  const content = await loadContent();
  const diagnostics = content.diagnostics.filter((d) => d.severity === 'error');
  if (diagnostics.length || !content.transitions)
    throw new Error(`Content validation failed: ${JSON.stringify(diagnostics)}`);
  const knowledge: KnowledgeBundle = {
    ...version,
    units: content.units.filter((u) => u.system === 'vedic' || u.system === 'common'),
    glossary: content.glossary.filter((g) => g.system === 'vedic' || g.system === 'common'),
    transitions: content.transitions,
  };
  const units = knowledge.units.filter((u) => u.system === 'vedic');
  const charts = await vedicCoverageCharts(randomCount);
  const coverageErrors = checkCoverage(
    units,
    charts,
    plan.map((section) => section.key),
  );
  const empty: Record<string, number> = Object.fromEntries(plan.map((section) => [section.key, 0]));
  const lengths = { zh: [] as number[], en: [] as number[] };
  const readabilityIssues: Record<string, number> = {};
  const reached = new Set<string>();
  const variants = new Set<string>();
  let maxTermDensity = 0;
  for (const chart of charts) {
    for (const unit of units) if (evaluateWhen(chart, unit.when).matched) reached.add(unit.id);
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'vedic',
        chart,
        locale,
        knowledge,
        context: {
          now: vedicCoverageNow,
          profileHasTime: !chart.noonChart,
          engineVersion: ENGINE_VERSION,
        },
      });
      for (const spec of plan) {
        const section = report.sections.find((s) => s.key === spec.key);
        if (!section?.lead || !section.blocks.some((b) => b.type === 'paragraph' && b.text.trim()))
          empty[spec.key]!++;
      }
      lengths[locale].push(
        locale === 'zh' ? report.readability.zhChars : report.readability.enWords,
      );
      maxTermDensity = Math.max(maxTermDensity, report.readability.termDensity);
      for (const issue of report.readability.issues)
        readabilityIssues[issue] = (readabilityIssues[issue] ?? 0) + 1;
      for (const hit of report.hits)
        if (hit.unitId.startsWith('vedic.moon.')) variants.add(hit.unitId);
    }
  }
  const statistics = {
    seed: vedicCoverageSeed,
    fixtures: 7,
    randomBirths: randomCount,
    boundaryBirths: 2,
    charts: charts.length,
    reports: charts.length * 2,
    units: units.length,
    unknownTimeCharts: charts.filter((c) => c.noonChart).length,
    outsideCurrentPeriodCharts: charts.filter((c) => !c.dasha.sequence.some((p) => p.current))
      .length,
    bySection: Object.fromEntries(
      plan.map((s) => [s.key, units.filter((u) => u.section === s.key).length]),
    ),
    emptySections: empty,
    chapterEmptyRates: Object.fromEntries(
      Object.entries(empty).map(([key, n]) => [key, n / (charts.length * 2)]),
    ),
    zhChars: { min: Math.min(...lengths.zh), max: Math.max(...lengths.zh) },
    enWords: { min: Math.min(...lengths.en), max: Math.max(...lengths.en) },
    maxTermDensity,
    readabilityIssues,
    naturalHits: reached.size,
    selectedVariants: variants.size,
    naturallyUnmatched: units.filter((u) => !reached.has(u.id)).map((u) => u.id),
    similarityWarnings: content.diagnostics.filter(
      (d) => d.severity === 'warning' && d.file.includes('/vedic/'),
    ).length,
  };
  return { knowledge, charts, statistics, coverageErrors };
}
