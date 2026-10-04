import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BirthInputSchema, BaziChartSchema, type BaziChart } from '@tianji/shared';
import { computeBazi, normalizeBirth } from '../../engine/src';
import { interpret } from '../../interpret/src';
import { loadContent, root } from './load';
import { checkCoverage } from './validation';
import plan from '../../interpret/src/plans/bazi.json';
import version from '../version.json';

export const coverageNow = '2026-10-04T00:00:00Z';
const places = [
  { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
  { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
  { name: 'Singapore', lat: 1.35, lng: 103.82, tz: 'Asia/Singapore' },
];

/** Deterministic legal births, across local time zones and known/unknown clocks. */
export function randomBaziCharts(count: number): BaziChart[] {
  // DESIGN-GAP: Fixed-seed sampling makes coverage reproducible; 1/5 unknown clocks
  // and 1900–2026 births also exercise dates outside the current decade-cycle list.
  let state = 23_026_004;
  const next = (size: number) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return Math.floor((state / 2 ** 32) * size);
  };
  return Array.from({ length: count }, (_, index) => {
    const birth = BirthInputSchema.parse({
      calendar: 'gregorian',
      year: 1900 + next(127),
      month: 1 + next(12),
      // Every selected day exists in every month, including leap years.
      day: 1 + next(28),
      hour: next(24),
      minute: next(60),
      timeUnknown: index % 5 === 0,
      gender: (['male', 'female', 'unspecified'] as const)[next(3)],
      place: places[next(places.length)],
    });
    return computeBazi(normalizeBirth(birth), {
      now: coverageNow,
      school: { ziHour: index % 2 === 0 ? 'zi_unified' : 'zi_split' },
    });
  });
}

/** Replays all frozen A–G fixtures and computes 500 legal random births in both locales. */
export async function auditBaziCoverage() {
  const content = await loadContent();
  const errors = content.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length || !content.transitions) throw new Error(JSON.stringify(errors));
  const fixtures: BaziChart[] = [];
  for (const name of [
    'A',
    'B',
    'B-split',
    'B-clock',
    'B-clock-split',
    'C',
    'D',
    'E',
    'G',
    'G-split',
  ]) {
    const value: unknown = JSON.parse(
      await readFile(join(root, '../engine/test/fixtures/bazi', `${name}.json`), 'utf8'),
    );
    if (!value || typeof value !== 'object' || !('input' in value))
      throw new Error(`Invalid fixture ${name}`);
    const birth = BirthInputSchema.parse(value.input);
    fixtures.push(
      computeBazi(normalizeBirth(birth), {
        now: coverageNow,
        school: {
          ziHour: name.endsWith('split') ? 'zi_split' : 'zi_unified',
          useApparentSolarTime: !name.includes('clock'),
        },
      }),
    );
  }
  const charts = [...fixtures, ...randomBaziCharts(500)];
  // Include both ends of the schema's legal birth range, before the first and
  // beyond the final displayed cycle, using a real engine result each time.
  for (const year of [1900, 2100]) {
    charts.push(
      computeBazi(
        normalizeBirth({
          calendar: 'gregorian',
          year,
          month: 1,
          day: 1,
          hour: 12,
          minute: 0,
          timeUnknown: true,
          gender: 'unspecified',
          place: places[0],
        }),
        { now: coverageNow },
      ),
    );
  }
  charts.forEach((chart) => BaziChartSchema.parse(chart));
  const units = content.units.filter((u) => u.system === 'bazi');
  const glossary = content.glossary.filter((g) => g.system === 'bazi' || g.system === 'common');
  const failures = checkCoverage(
    units,
    charts,
    plan.map((s) => s.key),
  );
  const empty = Object.fromEntries(plan.map((s) => [s.key, 0]));
  const minimum = { zh: Infinity, en: Infinity };
  const readabilityIssues: string[] = [];
  for (const [index, chart] of charts.entries()) {
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'bazi',
        chart,
        locale,
        knowledge: { ...version, ...content, glossary, transitions: content.transitions },
        context: { now: coverageNow, profileHasTime: chart.pillars.hour !== null },
      });
      for (const section of report.sections) {
        if (!report.hits.some((h) => h.section === section.key)) {
          empty[section.key] = (empty[section.key] ?? 0) + 1;
          failures.push(`${index}/${locale}/${section.key}: empty after interpretation`);
        }
      }
      minimum[locale] = Math.min(
        minimum[locale],
        locale === 'zh' ? report.readability.zhChars : report.readability.enWords,
      );
      if (!report.readability.passed)
        readabilityIssues.push(`${index}/${locale}: ${report.readability.issues.join(', ')}`);
    }
  }
  const summary = {
    knowledgeVersion: version.knowledgeVersion,
    units: units.length,
    fixtures: fixtures.length,
    randomBirths: 500,
    boundaryBirths: 2,
    charts: charts.length,
    reports: charts.length * 2,
    chapterEmptyRates: Object.fromEntries(
      Object.entries(empty).map(([key, n]) => [key, n / (charts.length * 2)]),
    ),
    minimumReportLength: minimum,
    similarityWarnings: content.diagnostics.filter((d) => d.severity === 'warning').length,
    failures,
    readabilityIssues,
  };
  return summary;
}
