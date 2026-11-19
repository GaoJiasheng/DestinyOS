import { computeZiwei, normalizeBirth } from '@tianji/engine';
import { BirthInputSchema, type ZiweiChart } from '@tianji/shared';
import type { CompiledScoringRules, Dim } from '@tianji/content';
import { ziweiEmphasis } from '../src/emphasis/evaluate';
import type { Emphasis } from '../src/emphasis/types';
/** The eight birth cities of the proposal's §6.1 sample. */
export const SAMPLE_CITIES = {
  beijing: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  guangzhou: { name: 'Guangzhou', lat: 23.13, lng: 113.26, tz: 'Asia/Shanghai' },
  taipei: { name: 'Taipei', lat: 25.03, lng: 121.56, tz: 'Asia/Taipei' },
  hong_kong: { name: 'Hong Kong', lat: 22.32, lng: 114.17, tz: 'Asia/Hong_Kong' },
  new_york: { name: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York' },
  vancouver: { name: 'Vancouver', lat: 49.28, lng: -123.12, tz: 'America/Vancouver' },
  sydney: { name: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' },
  london: { name: 'London', lat: 51.51, lng: -0.13, tz: 'Europe/London' },
} as const;
export type SampleChart = {
  birth: { date: string; time: string; city: keyof typeof SAMPLE_CITIES; gender: string };
  chart: ZiweiChart;
  emphasis: Emphasis;
};
/** mulberry32: tiny, well-distributed and identical on every JS engine. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Deterministic random Zi Wei charts: uniform dates in the year range, random clock, city and gender.
 * Every draw consumes the same five random numbers, so a rejected birth never shifts later ones. */
export function sampleCharts(
  count: number,
  calibration: { seed: number; years: number[]; now: string },
): { samples: SampleChart[]; failures: number } {
  const next = random(calibration.seed);
  const start = Date.UTC(calibration.years[0] ?? 1950, 0, 1);
  const days = Math.round((Date.UTC((calibration.years[1] ?? 2005) + 1, 0, 1) - start) / 86400000);
  const cities = Object.keys(SAMPLE_CITIES) as (keyof typeof SAMPLE_CITIES)[];
  const samples: SampleChart[] = [];
  let failures = 0;
  for (let n = 0; n < count; n++) {
    const day = new Date(start + Math.floor(next() * days) * 86400000);
    const hour = Math.floor(next() * 24);
    const minute = Math.floor(next() * 60);
    const city = cities[Math.floor(next() * cities.length)] ?? 'beijing';
    const gender = next() < 0.5 ? 'male' : 'female';
    try {
      const birth = BirthInputSchema.parse({
        calendar: 'gregorian',
        year: day.getUTCFullYear(),
        month: day.getUTCMonth() + 1,
        day: day.getUTCDate(),
        hour,
        minute,
        timeUnknown: false,
        place: SAMPLE_CITIES[city],
        gender,
      });
      const chart = computeZiwei({ birth: normalizeBirth(birth), now: calibration.now });
      samples.push({
        birth: {
          date: day.toISOString().slice(0, 10),
          time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          city,
          gender,
        },
        chart,
        emphasis: ziweiEmphasis(chart),
      });
    } catch {
      failures++;
    }
  }
  return { samples, failures };
}
const levelOf = (raw: number, cuts: number[]) => 2 + cuts.filter((c) => raw >= c).length;
function pearson(x: number[], y: number[]): number {
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  x.forEach((xi, i) => {
    const dx = xi - mx;
    const dy = (y[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}
/** Cutpoints from merged raw scores: for each quantile, the attained value whose share below it is closest. */
export function suggestCutpoints(raws: number[], quantiles: number[]): number[] {
  const sorted = [...raws].sort((a, b) => a - b);
  const values = [...new Set(sorted)];
  const below = (c: number) => sorted.filter((r) => r < c).length / sorted.length;
  const cuts: number[] = [];
  for (const q of quantiles) {
    const options = values.filter((v) => v > (cuts.at(-1) ?? -Infinity));
    const best = options.reduce(
      (pick, v) => (Math.abs(below(v) - q) < Math.abs(below(pick) - q) ? v : pick),
      options[0] ?? 0,
    );
    cuts.push(best);
  }
  return cuts;
}
export type EmphasisStats = ReturnType<typeof emphasisStats>;
/** Distribution figures used by the §6.6 checks and the calibration report. */
export function emphasisStats(samples: SampleChart[], rules: CompiledScoringRules, cuts: number[]) {
  const dims = rules.dims;
  const raw = (dim: Dim) => samples.map((s) => s.emphasis.dims[dim]?.raw ?? 0);
  const levels = Object.fromEntries(
    dims.map((dim) => {
      const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of raw(dim)) counts[levelOf(r, cuts)]! += 1;
      return [
        dim,
        Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / samples.length])),
      ];
    }),
  ) as Record<Dim, Record<string, number>>;
  const allSame =
    samples.filter(
      (s) => new Set(dims.map((d) => levelOf(s.emphasis.dims[d]?.raw ?? 0, cuts))).size === 1,
    ).length / samples.length;
  const correlations: { pair: string; r: number }[] = [];
  dims.forEach((a, i) =>
    dims
      .slice(i + 1)
      .forEach((b) => correlations.push({ pair: `${a}-${b}`, r: pearson(raw(a), raw(b)) })),
  );
  const instances = (rule: (typeof rules.rules)[number]) =>
    (rule.dims ?? dims).length * samples.length;
  const hitRates = rules.rules.map((rule) => {
    let perInstance = 0;
    let perChart = 0;
    for (const s of samples) {
      const fired = dims.filter((d) =>
        s.emphasis.dims[d]?.basis.some((b) => b.ruleId === rule.id),
      ).length;
      perInstance += fired;
      if (fired) perChart++;
    }
    return {
      id: rule.id,
      code: rule.code,
      instance: perInstance / instances(rule),
      chart: perChart / samples.length,
    };
  });
  let clamped = 0;
  const basisCounts: Record<string, number> = { '1': 0, '2-3': 0, '4+': 0 };
  for (const s of samples)
    for (const d of dims) {
      const dim = s.emphasis.dims[d];
      if (!dim) continue;
      const sum = dim.basis.reduce((t, b) => t + b.delta, 0);
      if (sum !== dim.raw) clamped++;
      const n = dim.basis.length;
      basisCounts[n <= 1 ? '1' : n <= 3 ? '2-3' : '4+']! += 1;
    }
  const moments = Object.fromEntries(
    dims.map((dim) => {
      const v = raw(dim);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
      return [
        dim,
        {
          mean,
          sd,
          zero: v.filter((x) => x === 0).length / v.length,
          min: Math.min(...v),
          max: Math.max(...v),
        },
      ];
    }),
  ) as Record<Dim, { mean: number; sd: number; zero: number; min: number; max: number }>;
  const instancesTotal = samples.length * dims.length;
  return {
    count: samples.length,
    cutpoints: cuts,
    levels,
    allSame,
    correlations,
    hitRates,
    clampRate: clamped / instancesTotal,
    basisCounts: Object.fromEntries(
      Object.entries(basisCounts).map(([k, v]) => [k, v / instancesTotal]),
    ),
    moments,
    topEmpty:
      samples.filter((s) => !dims.some((d) => levelOf(s.emphasis.dims[d]?.raw ?? 0, cuts) >= 4))
        .length / samples.length,
  };
}
