import { readFile } from 'node:fs/promises';
import { AstroChartSchema, BirthInputSchema, type BirthInput } from '@tianji/shared';
import { computeAstrology, normalizeBirth } from '../../engine/src';
import { createRandom } from '../../engine/src/common';
import { interpret } from '../../interpret/src';
import { conditions, resolvePath, type KnowledgeBundle } from '../src';
import { loadContent } from './load';
import { checkCoverage } from './validation';
import plan from '../../interpret/src/plans/astrology.json';
import version from '../version.json';

export const astrologyCoverageSeed = 'T-23-astrology-coverage-v1';
const places = [
  { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
  { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
  { name: 'Singapore', lat: 1.35, lng: 103.82, tz: 'Asia/Singapore' },
  { name: 'Tromso', lat: 69.65, lng: 18.96, tz: 'Europe/Oslo' },
] as const;

/** Compute A–G, fixed-seed legal births, and boundary cases; no personal data is printed. */
export async function astrologyCoverageCharts(randomCount = 500) {
  if (!Number.isInteger(randomCount) || randomCount < 1)
    throw new Error('Coverage needs a positive integer sample size');
  const births: BirthInput[] = await Promise.all(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(async (name) =>
      BirthInputSchema.parse(
        JSON.parse(
          await readFile(
            new URL(`../../engine/test/fixtures/birth/${name}.json`, import.meta.url),
            'utf8',
          ),
        ) as unknown,
      ),
    ),
  );
  const random = createRandom(astrologyCoverageSeed);
  const next = (size: number) => Math.floor(random.next() * size);
  // DESIGN-GAP: Fixed-seed 1900–2100 sampling includes 20% unknown clocks,
  // multiple time zones, both hemispheres, polar fallback and three house systems.
  for (let index = 0; index < randomCount; index++) {
    const year = 1900 + next(201),
      month = 1 + next(12);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    births.push(
      BirthInputSchema.parse({
        calendar: 'gregorian',
        year,
        month,
        day: 1 + next(days[month - 1]!),
        hour: next(24),
        minute: next(60),
        timeUnknown: index % 5 === 0,
        gender: (['male', 'female', 'unspecified'] as const)[next(3)],
        place: places[next(places.length)],
      }),
    );
  }
  for (const year of [1900, 2100]) {
    for (const mode of ['known', 'unknown', 'no_place'] as const)
      births.push(
        BirthInputSchema.parse({
          calendar: 'gregorian',
          year,
          month: 1,
          day: 1,
          hour: 12,
          minute: 0,
          timeUnknown: mode === 'unknown',
          gender: 'unspecified',
          ...(mode === 'no_place' ? {} : { place: places[0] }),
        }),
      );
  }
  return births.map((birth, index) => {
    const houseSystem =
      index < 7 ? 'placidus' : (['placidus', 'whole_sign', 'equal'] as const)[index % 3];
    const chart = AstroChartSchema.parse(computeAstrology(normalizeBirth(birth), { houseSystem }));
    return { chart, fixture: index < 7 ? String.fromCharCode(65 + index) : `sample-${index - 7}` };
  });
}

/** Validate source paths and run the real interpreter in both locales for every computed chart. */
export async function auditAstrology(randomCount = 500) {
  const content = await loadContent();
  const errors = content.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length || !content.transitions) throw new Error(JSON.stringify(errors));
  const knowledge: KnowledgeBundle = {
    ...version,
    units: content.units.filter((u) => u.system === 'astrology' || u.system === 'common'),
    glossary: content.glossary.filter((g) => g.system === 'astrology' || g.system === 'common'),
    transitions: content.transitions,
  };
  const units = knowledge.units.filter((u) => u.system === 'astrology');
  const samples = await astrologyCoverageCharts(randomCount);
  const charts = samples.map((s) => s.chart);
  const failures = checkCoverage(
    units,
    charts,
    plan.map((s) => s.key),
  );
  for (const unit of units)
    for (const condition of conditions(unit.when))
      if (!charts.some((chart) => resolvePath(chart, condition.path, true).length))
        failures.push(`${unit.id}: unresolved ${condition.path}`);
  const empty = Object.fromEntries(plan.map((s) => [s.key, 0]));
  const lengths = { zh: [] as number[], en: [] as number[] };
  const readabilityIssues: string[] = [];
  const variants = new Set<string>();
  for (const { chart, fixture } of samples) {
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'astrology',
        chart,
        locale,
        knowledge,
        context: { now: '2026-10-05T00:00:00Z', profileHasTime: !chart.noonChart },
      });
      if (report.sections.length !== plan.length)
        failures.push(`${fixture}/${locale}: chapter count`);
      for (const section of report.sections) {
        if (
          !report.hits.some((h) => h.section === section.key) ||
          !section.lead ||
          !section.blocks.some((b) => b.type === 'paragraph' && b.text)
        ) {
          empty[section.key] = (empty[section.key] ?? 0) + 1;
          failures.push(`${fixture}/${locale}/${section.key}: empty report section`);
        }
      }
      if (!report.readability.passed)
        readabilityIssues.push(`${fixture}/${locale}: ${report.readability.issues.join(', ')}`);
      lengths[locale].push(
        locale === 'zh' ? report.readability.zhChars : report.readability.enWords,
      );
      for (const hit of report.hits) if (/\.[ab]$/.test(hit.unitId)) variants.add(hit.unitId);
    }
  }
  const warningCounts = { astrology: 0, templates: 0, otherSystems: 0 };
  for (const diagnostic of content.diagnostics.filter((d) => d.severity === 'warning')) {
    if (diagnostic.file.includes('/astrology/')) {
      warningCounts.astrology++;
      if (/astrology\.(aspect|cusp)\./.test(diagnostic.message)) warningCounts.templates++;
    } else warningCounts.otherSystems++;
  }
  const statistics = {
    ...version,
    seed: astrologyCoverageSeed,
    units: units.length,
    fixtureBirths: 7,
    randomBirths: randomCount,
    boundaryBirths: 6,
    charts: charts.length,
    reports: charts.length * 2,
    unknownClocks: charts.filter((c) => c.noonChart).length,
    withoutHouses: charts.filter((c) => !c.houses).length,
    chapterEmptyRates: Object.fromEntries(
      Object.entries(empty).map(([k, n]) => [k, n / (charts.length * 2)]),
    ),
    reportLengths: Object.fromEntries(
      Object.entries(lengths).map(([k, values]) => [
        k,
        {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: Math.round(values.reduce((n, value) => n + value, 0) / values.length),
        },
      ]),
    ),
    selectedVariants: variants.size,
    similarityWarnings: warningCounts,
    failures,
    readabilityIssues,
  };
  return { knowledge, samples, statistics };
}
