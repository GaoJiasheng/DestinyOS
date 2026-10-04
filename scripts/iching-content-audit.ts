import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IchingChartSchema,
  IchingCategorySchema,
  RelationSchema,
  StrengthSchema,
  UseGodStateSchema,
  VerdictSchema,
  System,
  type IchingChart,
} from '../packages/shared/src';
import { computeIching } from '../packages/engine/src/iching';
import { createRandom } from '../packages/engine/src/common/random';
import { interpret } from '../packages/interpret/src';
import plan from '../packages/interpret/src/plans/iching.json';
import { conditions, evaluateWhen, type KnowledgeUnit } from '../packages/content/src';
import { loadContent, files, root } from '../packages/content/scripts/load';
import { checkCoverage } from '../packages/content/scripts/validation';
import version from '../packages/content/version.json';

const findingKeys = [
  'month_supports',
  'month_controls',
  'day_supports',
  'day_controls',
  'void',
  'moving',
  'return_generated',
  'return_controlled',
  'hidden',
  'absent',
  'illness',
  'rank',
  'ying',
  'vehicle',
  'shi_ying_same',
  'shi_generates_ying',
  'shi_controls_ying',
  'ying_controls_shi',
  'ying_generates_shi',
];
const categories = IchingCategorySchema.options;
const seed = 't23-iching-coverage-v1';

/** Generates legal, reproducible casts; I Ching uses casting time, not birth information. */
export function randomIchingCharts(count = 500): IchingChart[] {
  // DESIGN-GAP: This system has no birth dependency. Audit randomized legal casts and clocks instead.
  const random = createRandom(seed);
  const integer = (min: number, max: number) => min + Math.floor(random.next() * (max - min + 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: count }, (_, i) => {
    const timezone = ['Asia/Singapore', 'America/New_York', 'Europe/London', 'UTC'][i % 4]!;
    const at = `${integer(1970, 2099)}-${pad(integer(1, 12))}-${pad(integer(1, 28))}T${pad(integer(0, 23))}:00:00[${timezone}]`;
    const category = categories[i % categories.length]!;
    const method = Math.floor(i / categories.length) % 2 === 0 ? 'meihua' : 'liuyao';
    const chart =
      method === 'meihua'
        ? computeIching({
            method,
            category,
            seed: `${seed}-${i}`,
            meihua:
              i % 3 === 0
                ? { castBy: 'time', at }
                : i % 3 === 1
                  ? { castBy: 'random', at }
                  : {
                      castBy: 'numbers',
                      numbers: [integer(1, 999), integer(1, 999), integer(1, 999)],
                      at,
                    },
          })
        : computeIching({ method, category, seed: `${seed}-${i}` }, at);
    return IchingChartSchema.parse(chart);
  });
}

/** Verifies documented dimensions against actual condition values, including both authored variants. */
export function checkIchingDimensions(units: KnowledgeUnit[]): string[] {
  const issues: string[] = [];
  const has = (unit: KnowledgeUnit, path: string, value: unknown) =>
    conditions(unit.when).some(
      (c) =>
        c.path === path && ('eq' in c ? c.eq === value : 'contains' in c && c.contains === value),
    );
  const expect = (prefix: string, constraints: [string, unknown][], count: number) => {
    const hits = units.filter(
      (u) =>
        u.id.startsWith(`iching.${prefix}.`) &&
        u.meta.status === 'published' &&
        constraints.every(([p, v]) => has(u, p, v)),
    );
    if (hits.length !== count)
      issues.push(`${prefix} ${JSON.stringify(constraints)}: ${hits.length}/${count}`);
  };
  for (let n = 1; n <= 64; n++) expect('primary', [['primary.number', n]], 1);
  for (const relation of RelationSchema.options)
    for (const category of categories)
      expect(
        'relation',
        [
          ['method', 'meihua'],
          ['meihua.relation', relation],
          ['category', category],
        ],
        2,
      );
  for (const strength of StrengthSchema.options)
    expect(
      'seasonal_strength',
      [
        ['method', 'meihua'],
        ['meihua.seasonalStrength', strength],
      ],
      1,
    );
  for (const state of UseGodStateSchema.options)
    for (const category of categories)
      expect(
        'use_god',
        [
          ['method', 'liuyao'],
          ['liuyao.useGod.state', state],
          ['category', category],
        ],
        1,
      );
  for (const finding of findingKeys)
    expect(
      'finding',
      [
        ['method', 'liuyao'],
        ['liuyao.findings', finding],
      ],
      1,
    );
  for (const verdict of VerdictSchema.options)
    for (const category of categories)
      expect(
        'verdict',
        [
          ['verdict', verdict],
          ['category', category],
        ],
        1,
      );
  for (let count = 0; count <= 6; count++)
    expect('moving_lines', [['movingLines.length', count]], 1);
  for (const section of plan) {
    const fallback = units.filter(
      (u) =>
        u.id === `iching.fallback.${section.key}` &&
        u.section === section.key &&
        u.weight <= 1 &&
        u.meta.status === 'published',
    );
    if (fallback.length !== 1) issues.push(`Missing low-weight fallback: ${section.key}`);
  }
  return issues;
}

/** Runs the real engine and interpreter in both locales and returns aggregate coverage statistics. */
export async function auditIchingContent(count = 500) {
  const content = await loadContent();
  const errors = content.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length || !content.transitions) throw new Error(JSON.stringify(errors));
  const units = content.units.filter((u) => u.system === System.iching);
  const dimensions = checkIchingDimensions(units);
  if (dimensions.length) throw new Error(dimensions.join('\n'));
  const fixtures = await Promise.all(
    (await files(`${root}/test/fixtures`, '.json'))
      .filter((file) => file.split('/').at(-1)?.startsWith('iching.'))
      .map(async (file) => IchingChartSchema.parse(JSON.parse(await readFile(file, 'utf8')))),
  );
  const charts = [...fixtures, ...randomIchingCharts(count)];
  const coverage = checkCoverage(
    units,
    charts,
    plan.map((s) => s.key),
  );
  if (coverage.length) throw new Error(coverage.join('\n'));
  const knowledge = {
    ...version,
    units: content.units.filter((u) => u.system === System.iching || u.system === 'common'),
    glossary: content.glossary.filter((g) => g.system === System.iching || g.system === 'common'),
    transitions: content.transitions,
  };
  const empty: Record<string, number> = Object.fromEntries(plan.map((s) => [s.key, 0]));
  const minimum = { zhChars: Infinity, enWords: Infinity };
  const readabilityIssues: string[] = [];
  const methods = { meihua: 0, liuyao: 0 };
  const observed = {
    primary: new Set<number>(),
    movingCounts: new Set<number>(),
    states: new Set<string>(),
    findings: new Set<string>(),
    verdicts: new Set<string>(),
  };
  for (const [index, chart] of charts.entries()) {
    methods[chart.method]++;
    observed.primary.add(chart.primary.number);
    observed.movingCounts.add(chart.movingLines.length);
    observed.verdicts.add(chart.verdict);
    if (chart.liuyao) {
      observed.states.add(chart.liuyao.useGod.state);
      chart.liuyao.findings.forEach((key) => observed.findings.add(key));
    }
    for (const section of plan) {
      if (!units.some((u) => u.section === section.key && evaluateWhen(chart, u.when).matched))
        empty[section.key]!++;
      const fallback = units.find((u) => u.id === `iching.fallback.${section.key}`)!;
      if (!evaluateWhen(chart, fallback.when).matched)
        throw new Error(`Fallback failed: ${section.key}`);
    }
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: System.iching,
        chart,
        locale,
        knowledge,
        context: { now: chart.castAt.local, profileHasTime: true },
      });
      for (const section of plan) {
        const chapter = report.sections.find((s) => s.key === section.key);
        if (!chapter?.lead || !chapter.blocks.some((b) => b.type === 'paragraph'))
          throw new Error(`Empty report chapter ${index}/${locale}/${section.key}`);
      }
      if (!report.readability.passed)
        readabilityIssues.push(`${index}/${locale}: ${report.readability.issues.join(',')}`);
      if (locale === 'zh') minimum.zhChars = Math.min(minimum.zhChars, report.readability.zhChars);
      else minimum.enWords = Math.min(minimum.enWords, report.readability.enWords);
    }
  }
  if (readabilityIssues.length) throw new Error(readabilityIssues.join('\n'));
  return {
    seed,
    units: units.length,
    randomCasts: count,
    fixtures: fixtures.length,
    charts: charts.length,
    reports: charts.length * 2,
    methods,
    empty,
    minimum,
    readabilityPassed: charts.length * 2,
    similarityWarnings: content.diagnostics.filter((d) => d.severity === 'warning').length,
    observed: {
      hexagrams: observed.primary.size,
      movingCounts: [...observed.movingCounts].sort(),
      states: [...observed.states].sort(),
      findings: [...observed.findings].sort(),
      verdicts: [...observed.verdicts].sort(),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await auditIchingContent(), null, 2));
}
