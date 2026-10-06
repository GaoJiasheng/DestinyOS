import { fixtureReport, reportSignature, systems, type FixtureSystem } from './fixture';
import expected from './fixture-reference.json';
import charts from './chart-reference.json';
export type EngineMeasurement = {
  system: FixtureSystem;
  locale: 'zh' | 'en';
  coldMs: number;
  computeMs: number;
  interpretMs: number;
  maxMs: number;
  passed: boolean;
};
/** Measure cold and repeated compute+interpret, asserting reference results in the actual Hermes VM. */
export async function checkEngine(
  onProgress?: (rows: EngineMeasurement[]) => void,
): Promise<EngineMeasurement[]> {
  const rows: EngineMeasurement[] = [];
  // DESIGN-GAP: Compare four uncached runs per locale with Node references; allow only 1e-5 numeric drift across JS engines, while report signatures remain exact.
  for (const system of systems)
    for (const locale of ['zh', 'en'] as const) {
      const times: number[] = [];
      let passed = true;
      let computeMs = 0,
        interpretMs = 0;
      for (let run = 0; run < 4; run++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
        const start = performance.now();
        const { chart, report, timing } = fixtureReport(system, locale);
        computeMs = Math.max(computeMs, timing.computeMs);
        interpretMs = Math.max(interpretMs, timing.interpretMs);
        times.push(performance.now() - start);
        passed &&= matchesReference(chart, charts[system]) && report.readability.passed;
        passed &&=
          JSON.stringify(reportSignature(report)) === JSON.stringify(expected[system][locale]);
      }
      const maxMs = Math.max(...times);
      rows.push({
        system,
        locale,
        coldMs: times[0]!,
        maxMs,
        computeMs,
        interpretMs,
        passed: passed && maxMs <= 300,
      });
      onProgress?.([...rows]);
    }
  return rows;
}

/** Compare complete chart data with 1e-5 absolute numeric tolerance across JS engines. */
export function matchesReference(actual: unknown, reference: unknown): boolean {
  if (typeof actual === 'number' && typeof reference === 'number')
    return Math.abs(actual - reference) <= 1e-5;
  if (actual === reference) return true;
  if (!actual || !reference || typeof actual !== 'object' || typeof reference !== 'object')
    return false;
  const a = Object.entries(actual),
    b = Object.entries(reference);
  return (
    a.length === b.length &&
    a.every(
      ([key, value]) =>
        key in reference && matchesReference(value, (reference as Record<string, unknown>)[key]),
    )
  );
}

/** Exercise UTF-8 and DST-sensitive Intl before running deterministic seeded engines. */
export function checkRuntime() {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date('2024-03-10T07:00:00Z'));
  const encoded = [...new TextEncoder().encode('天机 🪙')];
  if (hour !== '03' || JSON.stringify(encoded) !== '[229,164,169,230,156,186,32,240,159,170,153]')
    throw new Error('Hermes Intl/UTF-8 mismatch');
  return { dstHour: hour, utf8: true, crypto: typeof globalThis.crypto !== 'undefined' };
}
