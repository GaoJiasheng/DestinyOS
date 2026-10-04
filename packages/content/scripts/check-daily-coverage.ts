import { readFile } from 'node:fs/promises';
import { BirthInputSchema, DailyChartSchema, type DailyChart } from '../../shared/src';
import { compute, createRandom, normalizeBirth } from '../../engine/src';
import { interpret } from '../../interpret/src';
import { evaluateWhen, type KnowledgeBundle } from '../src';
import { loadContent } from './load';
import { checkCoverage } from './validation';
import version from '../version.json';
import plan from '../../interpret/src/plans/daily.json';

export const dailyCoverageSeed = 'T-23-daily-coverage-v1';
const places = [
  { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
  { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
  { name: 'Tokyo', lat: 35.68, lng: 139.69, tz: 'Asia/Tokyo' },
];

/**
 * Audit A–G and seeded legal births through the daily engine and both report locales.
 * @param randomCount Number of random legal birth profiles after the seven A–G fixtures.
 * @returns Knowledge, computed charts, chapter/readability statistics and coverage failures.
 */
export async function auditDaily(randomCount = 500) {
  if (!Number.isInteger(randomCount) || randomCount < 0)
    throw new Error('randomCount must be a nonnegative integer');
  const content = await loadContent();
  const errors = content.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length || !content.transitions)
    throw new Error(`Content validation failed: ${JSON.stringify(errors)}`);
  const knowledge: KnowledgeBundle = {
    ...version,
    units: content.units.filter((u) => u.system === 'daily' || u.system === 'common'),
    glossary: content.glossary.filter((g) => g.system === 'daily' || g.system === 'common'),
    transitions: content.transitions,
  };
  const births: unknown[] = await Promise.all(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(
      async (name) =>
        JSON.parse(
          await readFile(
            new URL(`../../engine/test/fixtures/birth/${name}.json`, import.meta.url),
            'utf8',
          ),
        ) as unknown,
    ),
  );
  const random = createRandom(dailyCoverageSeed);
  for (let index = 0; index < randomCount; index++) {
    // DESIGN-GAP: Sample 1940–2005 births, all four named zones, and 28-day month bounds;
    // dates span 2025–2027 so daily sky conditions vary independently of natal dates.
    const timeUnknown = index % 5 === 0;
    births.push({
      calendar: 'gregorian',
      year: 1940 + Math.floor(random.next() * 66),
      month: 1 + Math.floor(random.next() * 12),
      day: 1 + Math.floor(random.next() * 28),
      ...(timeUnknown
        ? {}
        : { hour: Math.floor(random.next() * 24), minute: Math.floor(random.next() * 60) }),
      timeUnknown,
      gender: 'unspecified',
      place: places[index % places.length],
    });
  }
  const units = knowledge.units.filter((u) => u.system === 'daily');
  const charts: DailyChart[] = [];
  const empty: Record<string, number> = Object.fromEntries(plan.map((s) => [s.key, 0]));
  const lengths = { zh: [] as number[], en: [] as number[] };
  const issues: Record<string, number> = {};
  const reached = new Set<string>();
  const variants = new Set<string>();
  const bands = new Set<string>();
  let unknownTime = 0;
  for (const [index, raw] of births.entries()) {
    const birth = normalizeBirth(BirthInputSchema.parse(raw));
    if (birth.timeUnknown) unknownTime++;
    const year = index < 7 ? 2026 : 2025 + Math.floor(random.next() * 3);
    const month = index < 7 ? 10 : 1 + Math.floor(random.next() * 12);
    const day = index < 7 ? 4 : 1 + Math.floor(random.next() * 28);
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const chart = DailyChartSchema.parse(
      compute({
        system: 'daily',
        birth,
        now: `${date}T12:00:00Z`,
        seed: `${dailyCoverageSeed}:${index}`,
      }).chart,
    );
    charts.push(chart);
    bands.add(chart.oneLiner.split('.')[2]!);
    for (const unit of units) if (evaluateWhen(chart, unit.when).matched) reached.add(unit.id);
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'daily',
        chart,
        locale,
        knowledge,
        context: {
          now: chart.date.local,
          profileHasTime: !birth.timeUnknown,
          userId: `audit-${index}`,
        },
      });
      for (const section of plan) {
        const actual = report.sections.find((s) => s.key === section.key);
        if (!actual?.lead || !actual.blocks.some((b) => b.type === 'paragraph' && b.text.trim()))
          empty[section.key]!++;
      }
      lengths[locale].push(
        locale === 'zh' ? report.readability.zhChars : report.readability.enWords,
      );
      for (const issue of report.readability.issues) issues[issue] = (issues[issue] ?? 0) + 1;
      for (const hit of report.hits)
        if (hit.unitId.startsWith('daily.oneliner.') && /\.[ab]$/.test(hit.unitId))
          variants.add(hit.unitId);
    }
  }
  const coverageErrors = checkCoverage(
    units,
    charts,
    plan.map((s) => s.key),
  );
  const statistics = {
    seed: dailyCoverageSeed,
    fixtures: 7,
    randomBirths: randomCount,
    charts: charts.length,
    reports: charts.length * 2,
    unknownTime,
    units: units.length,
    glossary: content.glossary.length,
    bySection: Object.fromEntries(
      plan.map((s) => [s.key, units.filter((u) => u.section === s.key).length]),
    ),
    emptySections: empty,
    readabilityIssues: issues,
    zhChars: { min: Math.min(...lengths.zh), max: Math.max(...lengths.zh) },
    enWords: { min: Math.min(...lengths.en), max: Math.max(...lengths.en) },
    naturalHits: reached.size,
    naturallyUnmatched: units.filter((u) => !reached.has(u.id)).map((u) => u.id),
    selectedVariants: variants.size,
    observedBands: [...bands].sort(),
    similarityWarnings: content.diagnostics.filter(
      (d) => d.severity === 'warning' && d.file.includes('/daily/'),
    ).length,
  };
  return { knowledge, charts, statistics, coverageErrors };
}
