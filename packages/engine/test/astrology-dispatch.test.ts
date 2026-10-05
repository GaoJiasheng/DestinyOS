import { AstroChartSchema, VedicChartSchema, type AstroChart, type Body } from '@tianji/shared';
import { describe, expect, it } from 'vitest';
import {
  chartStats,
  compute,
  computeAstrology,
  computePositions,
  computeVedic,
  normalizeBirth,
  wrap,
} from '../src';
import { birth, close, jd, now } from './astrology-fixtures';
import A from './fixtures/birth/A.json';
import D from './fixtures/birth/D.json';
import E from './fixtures/birth/E.json';

describe('chart output, stats and deterministic dispatch', () => {
  it('produces validated western and Vedic charts and preserves normalization warnings', () => {
    const west = computeAstrology(birth),
      vedic = computeVedic(birth, now);
    expect(AstroChartSchema.safeParse(west).success).toBe(true);
    expect(VedicChartSchema.safeParse(vedic).success).toBe(true);
    expect(west.rulers.chartRuler).toBe('moon');
    expect(west.bodies.find((b) => b.key === 'chiron')?.approximate).toBe(true);
    expect(west.stats.elements).toEqual({ fire: 1, earth: 6, air: 0, water: 3 });
    expect(west.stats.modalities).toEqual({ cardinal: 6, fixed: 3, mutable: 1 });
    expect(west.stats.stelliums).toContainEqual({
      sign: 'capricorn',
      bodies: ['moon', 'saturn', 'uranus', 'neptune'],
    });
    expect(vedic.moon.nakshatra).toBe('uttara_ashadha');
    expect(vedic.moon.lord).toBe('surya');
    expect(vedic.lagna?.sign).toBe('gemini');
    expect(vedic.houses?.flatMap((h) => h.occupants)).toHaveLength(9);
    expect(vedic.bodies.find((b) => b.key === 'ketu')!.sidLon).toBeCloseTo(
      wrap(vedic.bodies.find((b) => b.key === 'rahu')!.sidLon + 180),
      8,
    );
    for (const system of ['astrology', 'vedic'] as const) {
      const r = compute({ system, birth, now });
      expect(JSON.stringify(compute({ system, birth, now }))).toBe(JSON.stringify(r));
      expect(r.meta.warnings).toContainEqual({
        code: 'W_DST_PERIOD',
        messageKey: 'engine.warnings.W_DST_PERIOD',
      });
      expect(r.meta.debug?.placeholder).toBeUndefined();
    }
  });
  it('Fixture D uses EDT UT and Fixture E has no axes, houses or Antar', () => {
    const d = normalizeBirth(D);
    expect(d.utc).toBe('1988-07-10T18:00:00Z');
    close(
      computeAstrology(d).bodies[0]!.lon,
      computePositions(jd('1988-07-10T18:00:00Z'), ['sun']).sun.lon,
      1e-8,
    );
    const unknown = normalizeBirth(E),
      w = computeAstrology(unknown),
      v = computeVedic(unknown, now);
    expect(w.noonChart).toBe(true);
    expect(w.angles).toBeNull();
    expect(w.houses).toBeNull();
    expect(w.stats.hemispheres).toBeNull();
    expect(w.bodies.find((b) => b.key === 'moon')?.uncertaintyDegrees).toBe(6);
    expect(v.lagna).toBeNull();
    expect(v.houses).toBeNull();
    expect(v.bodies.every((b) => b.house === null)).toBe(true);
    expect(v.dasha.sequence.every((m) => m.antar.length === 0)).toBe(true);
    expect(v.moon.possibleNakshatras).toEqual(['rohini', 'mrigashira']);
  });
  it('omits axes without place and respects optional schools', () => {
    const b = normalizeBirth({ ...A, place: undefined });
    expect(computeAstrology(b).angles).toBeNull();
    expect(computeVedic(b, now).panchangAtBirth).toBeUndefined();
    const traditional = computeAstrology(birth, {
      rulership: 'traditional',
      houseSystem: 'whole_sign',
      node: 'mean',
    });
    expect(traditional.houses?.find((h) => h.sign === 'scorpio')?.ruler).toBe('mars');
    expect(
      compute({ system: 'vedic', birth, now, options: { school: { node: 'true' } } }).meta
        .schoolUsed.node,
    ).toBe('true');
    const invalidWestern: Record<string, string | number | boolean>[] = [
      { unknown: true },
      { houseSystem: 'koch' },
      { zodiac: 'sidereal' },
      { node: 'wrong' },
      { rulership: 'wrong' },
    ];
    for (const school of invalidWestern)
      expect(() => compute({ system: 'astrology', birth, now, options: { school } })).toThrow(
        expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }),
      );
    const invalidVedic: Record<string, string | number | boolean>[] = [
      { ayanamsa: 'raman' },
      { houseSystem: 'equal' },
      { dasha: 'other' },
      { unknown: true },
    ];
    for (const school of invalidVedic)
      expect(() => compute({ system: 'vedic', birth, now, options: { school } })).toThrow(
        expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }),
      );
    expect(() => computeAstrology(birth, { houseSystem: 'koch' })).toThrow();
    expect(() => computeAstrology({ ...birth, jd: null })).toThrow();
    expect(() => computeVedic({ ...birth, jd: null }, now)).toThrow();
  });
  it('counts all hemispheres/quadrants, sign and house stelliums using only planets', () => {
    const body = (
      key: Body,
      sign: AstroChart['bodies'][number]['sign'],
      house: number | null,
    ): AstroChart['bodies'][number] => ({
      key,
      sign,
      house,
      lon: 0,
      lat: 0,
      degInSign: 0,
      retro: false,
      speed: 1,
    });
    const list = [
      body('sun', 'aries', 1),
      body('moon', 'aries', 2),
      body('mercury', 'aries', 3),
      body('venus', 'taurus', 4),
      body('mars', 'gemini', 5),
      body('jupiter', 'cancer', 6),
      body('saturn', 'leo', 7),
      body('uranus', 'virgo', 8),
      body('neptune', 'libra', 9),
      body('pluto', 'scorpio', 10),
      body('chiron', 'aries', 1),
    ];
    const s = chartStats(list);
    expect(s.quadrants).toEqual([3, 3, 3, 1]);
    expect(s.hemispheres).toEqual({ upper: 4, lower: 6, eastern: 4, western: 6 });
    expect(s.stelliums[0]?.bodies).toEqual(['sun', 'moon', 'mercury']);
  });
});
