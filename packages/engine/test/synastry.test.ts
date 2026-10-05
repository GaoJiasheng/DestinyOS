import { describe, expect, it } from 'vitest';
import {
  compute,
  normalizeBirth,
  computeSynastry,
  computeAshtakoot,
  compareBazi,
  compareZiwei,
  crossAspects,
  crossHouses,
  computeBazi,
  computeAstrology,
  computeZiwei,
} from '../src';
import { SynastryChartSchema, AshtakootChartSchema, type AstroChart } from '@tianji/shared';
import A from './fixtures/birth/A.json';
import B from './fixtures/birth/B.json';
import { BirthInputSchema } from '@tianji/shared';
const now = '2026-10-05T00:00:00Z',
  a = normalizeBirth(BirthInputSchema.parse(A)),
  b = normalizeBirth(BirthInputSchema.parse(B));
describe('Ashtakoot independently hand-calculated examples', () => {
  // Each ordered vector is Varna,Vashya,Tara,Yoni,Maitri,Gana,Bhakoot,Nadi; see systems/synastry.md.
  it.each([
    [10, 10, [1, 2, 3, 4, 5, 6, 7, 0], 28],
    [10, 20, [1, 2, 3, 2, 5, 6, 7, 8], 34],
    [10, 190, [1, 1, 1.5, 0, 3, 6, 7, 8], 27.5],
  ] as const)('Moons %i and %i', (first, second, scores, total) => {
    const result = computeAshtakoot(first, second);
    expect(result.kootas.map((k) => k.score)).toEqual(scores);
    expect(result.total).toBe(total);
  });
  it('directional traditional roles and half-point Tara are preserved', () => {
    expect(computeAshtakoot(20, 10).kootas[5]?.score).toBe(5);
    expect(computeAshtakoot(10, 30).kootas[2]?.score).toBe(1.5);
  });
  it('all 108 lunar padas cross all 108 padas produce bounded eight-part totals', () => {
    for (let i = 0; i < 108; i++)
      for (let j = 0; j < 108; j++) {
        const c = computeAshtakoot(((i + 0.5) * 360) / 108, ((j + 0.5) * 360) / 108);
        expect(c.total).toBe(c.kootas.reduce((s, k) => s + k.score, 0));
        expect(c.kootas.every((k, n) => k.max === n + 1 && k.score >= 0 && k.score <= k.max)).toBe(
          true,
        );
      }
  });
  it('Vashya changes precisely at Sagittarius and Capricorn half-sign boundaries', () => {
    expect(computeAshtakoot(254.999, 10).kootas[1]?.a).toBe('human');
    expect(computeAshtakoot(255, 10).kootas[1]?.a).toBe('quadruped');
    expect(computeAshtakoot(284.999, 10).kootas[1]?.a).toBe('quadruped');
    expect(computeAshtakoot(285, 10).kootas[1]?.a).toBe('aquatic');
  });
  it.each([NaN, Infinity, -1, 360])('rejects invalid longitude %s', (n) =>
    expect(() => computeAshtakoot(n, 10)).toThrow(),
  );
  it('schema rejects forged totals, weights, duplicate keys, and out-of-range scores', () => {
    const c = computeAshtakoot(10, 20);
    expect(AshtakootChartSchema.safeParse({ ...c, total: 0 }).success).toBe(false);
    expect(
      AshtakootChartSchema.safeParse({
        ...c,
        kootas: c.kootas.map((k, i) => (i ? k : { ...k, max: 2, score: 2, key: 'nadi' })),
      }).success,
    ).toBe(false);
  });
});
describe('four-tradition paired chart', () => {
  it('dispatch matches the pure engine, deterministic schema and school metadata', () => {
    const direct = computeSynastry(a, b, now),
      result = compute({ system: 'synastry', birth: a, partnerBirth: b, now });
    expect(result.chart).toEqual(direct);
    expect(SynastryChartSchema.parse(result.chart)).toEqual(direct);
    expect(result.meta.schoolUsed.ashtakoot).toBe('aifas_2021_base_v1');
    expect(direct.ziwei?.comparisons).toHaveLength(2);
    expect(direct.bazi.tenGodInteractions).toHaveLength(8);
    expect(direct.western.overlays).toHaveLength(26);
  });
  it('unknown times leave Ziwei unavailable, Guna provisional, and houses empty', () => {
    const unknown = normalizeBirth({
      ...BirthInputSchema.parse(A),
      timeUnknown: true,
      hour: undefined,
      minute: undefined,
    });
    const result = computeSynastry(unknown, unknown, now);
    expect(result.ziwei).toBeNull();
    expect(result.western.overlays).toEqual([]);
    expect(result.ashtakoot.provisional).toBe(true);
    expect(result.a.bazi.pillars.hour).toBeNull();
    expect(result.availability.complete).toBe(false);
    expect(
      compute({ system: 'synastry', birth: unknown, partnerBirth: b, now }).meta.warnings.some(
        (w) => w.code === 'W_NOON_CHART',
      ),
    ).toBe(true);
  });
  it('no place omits houses while retaining planet comparisons', () => {
    const noPlace = normalizeBirth({ ...BirthInputSchema.parse(A), place: undefined });
    const result = computeSynastry(noPlace, b, now);
    expect(result.availability.housesA).toBe(false);
    expect(result.western.overlays.every((r) => r.from === 'a')).toBe(true);
  });
  it('missing birth, second input, invalid normalized input and unsupported options reject', () => {
    expect(() => compute({ system: 'synastry', now })).toThrow();
    expect(() => compute({ system: 'synastry', birth: a, now })).toThrow();
    expect(() =>
      compute({
        system: 'synastry',
        birth: a,
        partnerBirth: b,
        now,
        options: { school: { method: 'unknown' } },
      }),
    ).toThrow();
    expect(() => computeSynastry({ ...a, jd: null }, b, now)).toThrow();
  });
  it('identical distributions have zero variation; unspecified spouse stars retain both sets', () => {
    const c = computeBazi(a, { now }),
      comparison = compareBazi(c, c, ['unspecified', 'female']);
    expect(comparison.elementComplementarity).toBe(0);
    expect(comparison.spouseStars[0]?.expected).toHaveLength(4);
    expect(comparison.spouseStars[1]?.expected).toEqual(['zheng_guan', 'qi_sha']);
    const d = structuredClone(c);
    d.dayMaster.stem = 'ji';
    d.pillars.day.branch = 'wu';
    const j = structuredClone(c);
    j.dayMaster.stem = 'jia';
    j.pillars.day.branch = 'zi';
    expect(compareBazi(j, d, ['male', 'male']).dayStemRelations).toEqual(['combine']);
    d.dayMaster.stem = 'geng';
    expect(compareBazi(j, d, ['female', 'unspecified']).dayStemRelations).toEqual(['clash']);
    expect(compareBazi(j, d, ['female', 'unspecified']).dayBranchRelations).toContain('clash');
  });
  it('includes same-planet cross aspects, orb edges, and wrapped zero-degree houses', () => {
    const c = computeAstrology(a),
      d: AstroChart = { ...c, bodies: [{ ...c.bodies[0]!, key: 'sun', lon: 359 }], houses: null };
    const e: AstroChart = { ...c, bodies: [{ ...c.bodies[0]!, key: 'sun', lon: 1 }] };
    expect(crossAspects(d, e)).toContainEqual({
      a: 'sun',
      b: 'sun',
      type: 'conjunction',
      orb: 2,
      separation: 2,
    });
    expect(crossHouses(d, d)).toEqual([]);
    expect(crossHouses(d, e)).toHaveLength(1);
    e.bodies[0]!.lon = 9;
    expect(crossAspects(d, e).some((r) => r.type === 'conjunction')).toBe(true);
    e.bodies[0]!.lon = 9.001;
    expect(crossAspects(d, e).some((r) => r.type === 'conjunction')).toBe(false);
  });
  it('cross-Ziwei mutagen targets agree with actual recipient stars and triangle offsets', () => {
    const first = computeZiwei({ birth: a, now }),
      second = computeZiwei({ birth: b, now }),
      comparison = compareZiwei(first, second);
    expect(comparison.transformations.length).toBeGreaterThan(0);
    for (const hit of comparison.transformations) {
      const target = hit.from === 'a' ? second : first,
        palace = target.palaces.find((p) => p.key === hit.target)!;
      expect([...palace.majorStars, ...palace.minorStars].some((s) => s.key === hit.star)).toBe(
        true,
      );
      expect(hit.inLifeTriangle).toBe(
        [0, 4, 6, 8].includes(
          (palace.index - target.palaces.find((p) => p.key === 'life')!.index + 12) % 12,
        ),
      );
    }
  });
});
