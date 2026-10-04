import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { computeZiwei, normalizeBirth } from '../packages/engine/src';
import { BirthInputSchema, ZiweiChartSchema, type ZiweiChart } from '../packages/shared/src';
import { loadContent } from '../packages/content/scripts/load';
import { checkCoverage } from '../packages/content/scripts/validation';
import { evaluateWhen } from '../packages/content/src';
import type { KnowledgeBundle } from '../packages/content/src';
import { interpret } from '../packages/interpret/src';
import plan from '../packages/interpret/src/plans/ziwei.json';
import version from '../packages/content/version.json';

const now = '2026-10-04T00:00:00Z';
// DESIGN-GAP: Fixed seed and explicit now make the 500 legitimate Gregorian samples reproducible;
// years 1960–2025 stay inside the engine's available decadal range at this now. No birthdays are logged.
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Compute legal seeded births plus applicable A–G fixtures; E must reject missing time. */
export async function coverageCharts(count = 500): Promise<ZiweiChart[]> {
  const charts: ZiweiChart[] = [];
  for (const key of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    const input: unknown = JSON.parse(
      await readFile(
        new URL(`../packages/engine/test/fixtures/birth/${key}.json`, import.meta.url),
        'utf8',
      ),
    );
    if (key === 'E') {
      try {
        computeZiwei({ birth: normalizeBirth(input), now });
        throw new Error('Fixture E should reject unknown birth time');
      } catch (error) {
        if (
          !error ||
          typeof error !== 'object' ||
          !('code' in error) ||
          error.code !== 'E_REQUIRES_BIRTH_TIME'
        )
          throw error;
      }
    } else charts.push(ZiweiChartSchema.parse(computeZiwei({ birth: normalizeBirth(input), now })));
  }
  const next = random(23);
  const places = [
    { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
    { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
    { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
    { name: 'London', lat: 51.51, lng: -0.13, tz: 'Europe/London' },
    { name: 'Singapore', lat: 1.35, lng: 103.82, tz: 'Asia/Singapore' },
  ];
  for (let index = 0; index < count; index++) {
    const input = BirthInputSchema.parse({
      calendar: 'gregorian',
      year: 1960 + Math.floor(next() * 66),
      month: 1 + Math.floor(next() * 12),
      day: 1 + Math.floor(next() * 28),
      hour: Math.floor(next() * 24),
      minute: Math.floor(next() * 60),
      timeUnknown: false,
      gender: ['male', 'female', 'unspecified'][Math.floor(next() * 3)],
      place: places[Math.floor(next() * places.length)],
    });
    charts.push(ZiweiChartSchema.parse(computeZiwei({ birth: normalizeBirth(input), now })));
  }
  return charts;
}

/** Run the actual engine and bilingual interpreter, reporting chapter gaps and readability minima. */
export async function checkZiweiContent(count = 500) {
  const content = await loadContent();
  const errors = content.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length || !content.transitions) throw new Error(`Content errors: ${errors.length}`);
  const units = content.units.filter((u) => u.system === 'ziwei');
  const knowledge: KnowledgeBundle = {
    ...version,
    units: content.units.filter((u) => u.system === 'ziwei' || u.system === 'common'),
    glossary: content.glossary.filter((g) => g.system === 'ziwei' || g.system === 'common'),
    transitions: content.transitions,
  };
  const charts = await coverageCharts(count);
  const gaps = checkCoverage(
    units,
    charts,
    plan.map((s) => s.key),
  );
  const empty: Record<string, number> = Object.fromEntries(plan.map((s) => [s.key, 0]));
  let minZhChars = Infinity;
  let minEnWords = Infinity;
  let maxTermDensity = 0;
  let unreadable = 0;
  const reached = new Set<string>();
  for (const chart of charts) {
    for (const unit of units) if (evaluateWhen(chart, unit.when).matched) reached.add(unit.id);
    for (const locale of ['zh', 'en'] as const) {
      const report = interpret({
        system: 'ziwei',
        chart,
        locale,
        knowledge,
        context: { now, profileHasTime: true },
      });
      for (const section of report.sections)
        if (!section.lead || !section.blocks.some((b) => b.type === 'paragraph' && b.text.trim()))
          empty[section.key] = (empty[section.key] ?? 0) + 1;
      if (locale === 'zh') minZhChars = Math.min(minZhChars, report.readability.zhChars);
      else minEnWords = Math.min(minEnWords, report.readability.enWords);
      maxTermDensity = Math.max(maxTermDensity, report.readability.termDensity);
      if (!report.readability.passed) unreadable++;
    }
  }
  const result = {
    knowledgeVersion: version.knowledgeVersion,
    units: units.length,
    randomBirths: count,
    applicableFixtures: 6,
    missingTimeRejected: true,
    charts: charts.length,
    reports: charts.length * 2,
    emptyChapters: empty,
    minZhChars,
    minEnWords,
    maxTermDensity,
    unreadableReports: unreadable,
    matchedUnits: reached.size,
    unmatchedUnits: units.filter((u) => !reached.has(u.id)).map((u) => u.id),
    similarityWarnings: content.diagnostics.filter((d) => d.severity === 'warning').length,
  };
  if (gaps.length || Object.values(empty).some(Boolean) || unreadable)
    throw new Error(`Coverage/readability failed: ${JSON.stringify(result)}; ${gaps.join('; ')}`);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await checkZiweiContent(), null, 2));
