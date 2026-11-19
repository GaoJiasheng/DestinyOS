import { describe, expect, it } from 'vitest';
import { ziweiScoringRules as rules } from '@tianji/content/scoring/ziwei-rules';
import { emphasisStats, sampleCharts } from '../scripts/emphasis-sample';
// DESIGN-GAP: §6.6 specifies N = 2000; the unit suite uses the first 600 charts of the same seeded
// sample (~12 s) and keeps every threshold. `pnpm emphasis:calibrate` runs the full 2000.
const SAMPLE = 600;
const { samples, failures } = sampleCharts(SAMPLE, {
  seed: 20261116,
  years: [1950, 2005],
  now: '2026-11-16T00:00:00Z',
});
const cuts = rules.cutpoints.map((c) => c / rules.unit);
const stats = emphasisStats(samples, rules, cuts);
describe(`Zi Wei emphasis distribution (seed 20261116, N = ${SAMPLE})`, () => {
  it('charts every sampled birth', () => {
    expect(failures).toBe(0);
    expect(stats.count).toBe(SAMPLE);
  });
  it('uses all four bands in every dimension with none above 45%', () => {
    for (const dim of rules.dims)
      for (const level of ['2', '3', '4', '5']) {
        const share = stats.levels[dim][level] ?? 0;
        expect(share, `${dim} level ${level}`).toBeGreaterThan(0);
        expect(share, `${dim} level ${level}`).toBeLessThanOrEqual(0.45);
      }
  });
  it('rarely puts all dimensions in one band and keeps dimensions largely independent', () => {
    expect(stats.allSame).toBeLessThan(0.03);
    // career–love share the 夫官 axis (documented in scoring.yaml) and still stay below 0.5.
    for (const { pair, r } of stats.correlations) expect(Math.abs(r), pair).toBeLessThan(0.5);
  });
  it('keeps every rule between 1% and 97% of applicable palaces and clamps under 5%', () => {
    for (const hit of stats.hitRates) {
      expect(hit.instance, hit.id).toBeGreaterThanOrEqual(0.01);
      expect(hit.instance, hit.id).toBeLessThanOrEqual(0.97);
    }
    expect(stats.clampRate).toBeLessThan(0.05);
  });
});
