import { readFile } from 'node:fs/promises';
import {
  BirthInputSchema,
  SpreadKeySchema,
  CategorySchema,
  TarotChartSchema,
} from '../../shared/src';
import { computeTarot, TAROT_COMBINATIONS } from '../../engine/src/tarot';
import { createRandom } from '../../engine/src/common';
import { interpret } from '../../interpret/src';
import { evaluateWhen, type KnowledgeBundle } from '../src';
import { loadContent } from './load';
import { checkCoverage } from './validation';
import version from '../version.json';
import plan from '../../interpret/src/plans/tarot.json';

export const tarotCoverageSeed = 'T-23-tarot-coverage-v1';

/** Validate A–G and legal random birth inputs; tarot uses only a deterministic seed, not a birth clock. */
export async function tarotCoverageCharts(randomCount = 500) {
  const random = createRandom(tarotCoverageSeed);
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
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
    births.push({
      calendar: 'gregorian',
      year,
      month,
      day: 1 + Math.floor(random.next() * days),
      hour: Math.floor(random.next() * 24),
      minute: Math.floor(random.next() * 60),
      timeUnknown: false,
      gender: 'unspecified',
      place: { name: 'Synthetic coverage', lat: 0, lng: 0, tz: 'UTC' },
    });
  }
  return births.map((raw, index) => {
    BirthInputSchema.parse(raw);
    // DESIGN-GAP: Tarot is birth-independent. Stratify all eight spreads, six categories and
    // both reversal settings; synthetic birth validation does not imply a birth-based reading.
    const spread = SpreadKeySchema.options[index % SpreadKeySchema.options.length]!;
    const category = CategorySchema.options[Math.floor(index / 8) % CategorySchema.options.length]!;
    const allowReversed = Math.floor(index / 48) % 2 === 0;
    const chart = TarotChartSchema.parse(
      computeTarot({
        seed: `${tarotCoverageSeed}:${index}`,
        spread,
        category,
        allowReversed,
      }),
    );
    return { chart, fixture: index < 7 ? String.fromCharCode(65 + index) : `random-${index - 7}` };
  });
}

/** Find legal engine draws witnessing every pair, without fabricating cards or statistics. */
export function tarotCombinationWitnesses() {
  const witnesses = new Map<string, ReturnType<typeof computeTarot>>();
  for (let index = 0; index < 10_000 && witnesses.size < TAROT_COMBINATIONS.length; index++) {
    const chart = computeTarot({
      seed: `${tarotCoverageSeed}:pair:${index}`,
      spread: 'year_ahead',
    });
    for (const pair of TAROT_COMBINATIONS)
      if (chart.combos.includes(pair.key)) witnesses.set(pair.key, chart);
  }
  if (witnesses.size !== TAROT_COMBINATIONS.length) throw new Error('Missing tarot pair witnesses');
  return witnesses;
}

/** Audit source knowledge through actual engine draws and both locale report assemblers. */
export async function auditTarot(randomCount = 500) {
  const content = await loadContent();
  const errors = content.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length || !content.transitions)
    throw new Error(`Invalid content: ${JSON.stringify(errors)}`);
  const knowledge: KnowledgeBundle = {
    ...version,
    units: content.units.filter((u) => u.system === 'tarot' || u.system === 'common'),
    glossary: content.glossary.filter((g) => g.system === 'tarot' || g.system === 'common'),
    transitions: content.transitions,
  };
  const units = knowledge.units.filter((u) => u.system === 'tarot');
  const samples = await tarotCoverageCharts(randomCount);
  const coverageErrors = checkCoverage(
    units,
    samples.map((s) => s.chart),
    plan.map((s) => s.key),
  );
  const empty: Record<string, number> = Object.fromEntries(plan.map((s) => [s.key, 0]));
  const issues: Record<string, number> = {};
  const lengths = { zh: [] as number[], en: [] as number[] };
  const reached = new Set<string>();
  const spreadCategories = new Set<string>();
  for (const { chart } of samples) {
    spreadCategories.add(`${chart.spread}.${chart.category}`);
    for (const u of units) if (evaluateWhen(chart, u.when).matched) reached.add(u.id);
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'tarot',
        chart,
        locale,
        knowledge,
        context: { now: '2026-10-05', profileHasTime: true },
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
    }
  }
  const witnesses = tarotCombinationWitnesses();
  const statistics = {
    seed: tarotCoverageSeed,
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
    spreadCategoryCombinations: spreadCategories.size,
    pairWitnesses: witnesses.size,
    similarityWarnings: content.diagnostics.filter(
      (d) => d.severity === 'warning' && /\/tarot\//.test(d.file),
    ).length,
  };
  return { knowledge, samples, witnesses, statistics, coverageErrors };
}
