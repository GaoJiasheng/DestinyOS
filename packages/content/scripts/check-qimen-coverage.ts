import { readFile } from 'node:fs/promises';
import { BirthInputSchema, QimenChartSchema, QimenCategorySchema } from '../../shared/src';
import { computeQimen, PATTERN_RULES } from '../../engine/src/qimen';
import { createRandom, normalizeBirth } from '../../engine/src/common';
import { interpret } from '../../interpret/src';
import { evaluateWhen, type KnowledgeBundle } from '../src';
import { loadContent } from './load';
import { checkCoverage } from './validation';
import version from '../version.json';
import plan from '../../interpret/src/plans/qimen.json';

export const qimenCoverageSeed = 'T-23-qimen-coverage-v1';
const categories = QimenCategorySchema.options;
const zones = ['Asia/Shanghai', 'America/New_York', 'Australia/Sydney', 'UTC'];
const school = {
  layout: 'rotating',
  juMethod: 'chaibu',
  centerLodge: 'kun2',
  useApparentSolarTime: false,
} as const;

/** Build A–G and deterministic random legal births, then use their clock as the Qimen casting time. */
export async function qimenCoverageCharts(randomCount = 500) {
  const random = createRandom(qimenCoverageSeed);
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
  for (let index = 0; index < randomCount; index++) {
    const year = 1900 + Math.floor(random.next() * 201);
    const month = 1 + Math.floor(random.next() * 12);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
    births.push({
      calendar: 'gregorian',
      year,
      month,
      day: 1 + Math.floor(random.next() * daysInMonth),
      hour: Math.floor(random.next() * 24),
      minute: Math.floor(random.next() * 60),
      timeUnknown: false,
      gender: 'unspecified',
      place: {
        name: 'Coverage fixture',
        lat: 0,
        lng: 0,
        tz: zones[index % zones.length],
      },
    });
  }
  return births.map((raw, index) => {
    const birth = BirthInputSchema.parse(raw);
    const normalized = normalizeBirth(birth);
    // DESIGN-GAP: Qimen needs an explicit casting clock, not an unknown birth clock; fixture E is cast at noon for coverage only.
    const { year, month, day, hour, minute, tz } = normalized.local;
    const padded = (number: number) => String(number).padStart(2, '0');
    const at = `${year}-${padded(month)}-${padded(day)}T${padded(hour ?? 12)}:${padded(minute ?? 0)}[${tz}]`;
    const category = categories[index % categories.length]!;
    const chart = QimenChartSchema.parse(computeQimen({ at, category, options: { school } }));
    return {
      chart,
      category,
      fixture: index < 7 ? String.fromCharCode(65 + index) : `random-${index - 7}`,
    };
  });
}

/** Audit actual source content through the engine and both locale report assemblers. */
export async function auditQimen(randomCount = 500) {
  const content = await loadContent();
  const errors = content.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length || !content.transitions)
    throw new Error(`Content validation failed: ${JSON.stringify(errors)}`);
  const knowledge: KnowledgeBundle = {
    ...version,
    units: content.units.filter((u) => u.system === 'qimen' || u.system === 'common'),
    glossary: content.glossary.filter((g) => g.system === 'qimen' || g.system === 'common'),
    transitions: content.transitions,
  };
  const units = knowledge.units.filter((u) => u.system === 'qimen');
  const samples = await qimenCoverageCharts(randomCount);
  const coverageErrors = checkCoverage(
    units,
    samples.map((s) => s.chart),
    plan.map((s) => s.key),
  );
  const empty: Record<string, number> = Object.fromEntries(plan.map((s) => [s.key, 0]));
  const lengths = { zh: [] as number[], en: [] as number[] };
  const issues: Record<string, number> = {};
  const reached = new Set<string>();
  const variants = new Set<string>();
  const verdictCategories = new Set<string>();
  for (const { chart, category } of samples) {
    verdictCategories.add(`${category}.${chart.verdict}`);
    for (const unit of units) if (evaluateWhen(chart, unit.when).matched) reached.add(unit.id);
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'qimen',
        chart,
        locale,
        knowledge,
        context: { now: chart.castAt.local, profileHasTime: true },
      });
      for (const spec of plan) {
        const section = report.sections.find((s) => s.key === spec.key);
        if (!section?.lead || !section.blocks.some((b) => b.type === 'paragraph' && b.text.trim()))
          empty[spec.key]!++;
      }
      lengths[locale].push(
        locale === 'zh' ? report.readability.zhChars : report.readability.enWords,
      );
      for (const issue of report.readability.issues) issues[issue] = (issues[issue] ?? 0) + 1;
      for (const hit of report.hits)
        if (/\.use_gods\..*\.[ab]$/.test(hit.unitId)) variants.add(hit.unitId);
    }
  }
  const statistics = {
    seed: qimenCoverageSeed,
    fixtures: 7,
    randomBirths: randomCount,
    charts: samples.length,
    reports: samples.length * 2,
    units: units.length,
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
    verdictCategoryCombinations: verdictCategories.size,
    patternKeys: PATTERN_RULES.length,
    similarityWarnings: content.diagnostics.filter((d) => d.severity === 'warning').length,
  };
  return { knowledge, samples, statistics, coverageErrors };
}
