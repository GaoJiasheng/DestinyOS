import { describe, expect, it } from 'vitest';
import {
  compute,
  computeAngles,
  computeHouses,
  gmst,
  houseAt,
  lst,
  normalizeBirth,
  signed,
  wrap,
} from '../src';
import { birth, close, now } from './astrology-fixtures';
import goldenA from './fixtures/astrology/A.json';
import A from './fixtures/birth/A.json';

describe('angles and house geometry', () => {
  it('verifies J2000 mean sidereal anchor and local east-positive offset', () => {
    close(gmst(2451545), 280.46061837, 1e-8);
    close(lst(2451545, 116.4), 36.86061837, 1e-8);
  });
  it('verifies Fixture A axes with independent coordinate geometry and Placidus semi-arc equations', () => {
    const a = computeAngles(birth.jd!, 39.9, 116.4),
      e = (a.obliquity * Math.PI) / 180,
      phi = (39.9 * Math.PI) / 180;
    close(a.asc, goldenA.asc, goldenA.tolerances.angle);
    close(a.mc, goldenA.mc, goldenA.tolerances.angle);
    // These rounded expected values are checked below against the independent semi-arc definition, not an astro.com export.
    const expected = goldenA.placidus,
      h = computeHouses('placidus', a.asc, a.mc, 39.9, a.obliquity);
    h.forEach((c, i) => close(c, expected[i]!, goldenA.tolerances.house));
    const rightAscension = (lon: number) =>
      wrap(
        (Math.atan2(
          Math.sin((lon * Math.PI) / 180) * Math.cos(e),
          Math.cos((lon * Math.PI) / 180),
        ) *
          180) /
          Math.PI,
      );
    for (const [index, fraction] of [
      [10, 1 / 3],
      [11, 2 / 3],
    ] as const) {
      const dec = Math.asin(Math.sin(e) * Math.sin((h[index]! * Math.PI) / 180)),
        semi = (Math.acos(-Math.tan(phi) * Math.tan(dec)) * 180) / Math.PI;
      expect(wrap(rightAscension(h[index]!) - a.ramc)).toBeCloseTo(semi * fraction, 6);
    }
    // ASC is the eastern horizon: cos(hour angle)=-tan(latitude)*tan(declination).
    const dec = Math.asin(Math.sin(e) * Math.sin((a.asc * Math.PI) / 180)),
      hour = (signed(a.ramc - rightAscension(a.asc)) * Math.PI) / 180;
    expect(Math.cos(hour)).toBeCloseTo(-Math.tan(phi) * Math.tan(dec), 8);
    expect(hour).toBeLessThan(0);
  });
  it.each([-65, -33.87, 0, 39.9, 65, 66])(
    'maintains ordered, opposite cusps at latitude %s',
    (lat) => {
      const a = computeAngles(2451545, lat, 0),
        h = computeHouses('placidus', a.asc, a.mc, lat, a.obliquity);
      expect(h).toHaveLength(12);
      expect(h.reduce((sum, c, i) => sum + wrap(h[(i + 1) % 12]! - c), 0)).toBeCloseTo(360, 5);
      for (let i = 0; i < 6; i++) close(h[i + 6]!, wrap(h[i]! + 180), 1e-8);
    },
  );
  it('implements Equal and Whole Sign at wrap and the documented high-latitude cutoff', () => {
    expect(computeHouses('whole_sign', 359, 0, 0, 23.4)).toEqual([
      330, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300,
    ]);
    expect(computeHouses('equal', 359, 0, 0, 23.4)).toEqual([
      359, 29, 59, 89, 119, 149, 179, 209, 239, 269, 299, 329,
    ]);
    expect(computeHouses('placidus', 359, 0, 66.01, 23.4)).toEqual(
      computeHouses('whole_sign', 359, 0, 66.01, 23.4),
    );
    expect(computeHouses('placidus', 359, 0, -67, 23.4)).toEqual(
      computeHouses('whole_sign', 359, 0, -67, 23.4),
    );
    expect(() => computeHouses('koch', 90, 0, 0, 23.4)).toThrow(
      expect.objectContaining({ code: 'E_UNSUPPORTED_SCHOOL' }),
    );
    expect(houseAt(359, [330, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300])).toBe(1);
    expect(houseAt(0, [330, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300])).toBe(2);
    expect(() => houseAt(0, [])).toThrow(expect.objectContaining({ code: 'E_EPHEMERIS' }));
  });
  it('echoes fallback school and bilingual warning, both hemispheres', () => {
    for (const lat of [67, -67]) {
      const b = normalizeBirth({ ...A, place: { ...A.place, lat } }),
        r = compute({ system: 'astrology', birth: b, now });
      expect(r.meta.schoolUsed.houseSystem).toBe('whole_sign');
      expect(r.meta.warnings).toContainEqual({
        code: 'W_HOUSE_SYSTEM_FALLBACK',
        messageKey: 'engine.warnings.W_HOUSE_SYSTEM_FALLBACK',
      });
    }
    expect(
      compute({ system: 'astrology', birth, now, options: { school: { houseSystem: 'equal' } } })
        .meta.schoolUsed.houseSystem,
    ).toBe('equal');
  });
});
