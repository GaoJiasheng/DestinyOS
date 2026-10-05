import { Planet } from '@tianji/shared';
import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import {
  astroTime,
  computePositions,
  distance,
  meanLilith,
  meanNorthNode,
  moonPhase,
  signed,
  sunriseSunset,
  trueNorthNode,
} from '../src';
import { birth, close, jd } from './astrology-fixtures';
import goldenA from './fixtures/astrology/A.json';

describe('apparent geocentric ephemeris and independently calculated Fixture A', () => {
  it.each([
    ['sun', Astronomy.Body.Sun, goldenA.sun],
    ['moon', Astronomy.Body.Moon, goldenA.moon],
  ] as const)(
    'independently verifies %s at the documented ±0.1° tolerance',
    (key, body, expected) => {
      // Independent direct library calls: no wrapper time, longitude or normalization helpers.
      const time = new Astronomy.AstroTime(-3518.5208333335),
        vector = Astronomy.GeoVector(body, time, true),
        ecliptic = Astronomy.Ecliptic(vector);
      close(ecliptic.elon, expected, 0.1);
      close(computePositions(birth.jd!, [key])[key].lon, ecliptic.elon, 0.000001);
    },
  );
  it.each(Object.values(Planet))(
    'returns finite %s positions, wrap-safe speed and retrograde flag',
    (key) => {
      const p = computePositions(birth.jd!, [key])[key];
      expect(p.lon).toBeGreaterThanOrEqual(0);
      expect(p.lon).toBeLessThan(360);
      expect(Number.isFinite(p.lat)).toBe(true);
      const before = computePositions(birth.jd! - 0.01, [key])[key],
        after = computePositions(birth.jd! + 0.01, [key])[key];
      expect(p.speed).toBeCloseTo(signed(after.lon - before.lon) / 0.02, 3);
      expect(p.retrograde).toBe(p.speed < 0);
    },
  );
  it.each([2415020.5, 2451544.5, 2462502.5, 2488069.5])(
    'agrees with direct library positions across the supported range at JD %s',
    (time) => {
      const result = computePositions(time, [
        'sun',
        'moon',
        'mercury',
        'venus',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
        'pluto',
      ]);
      for (const body of Object.keys(result) as (keyof typeof result)[]) {
        const e = Astronomy.Ecliptic(
          Astronomy.GeoVector(
            (body[0]!.toUpperCase() + body.slice(1)) as Astronomy.Body,
            new Astronomy.AstroTime(time - 2451545),
            true,
          ),
        );
        close(result[body].lon, e.elon, 0.1);
      }
    },
  );
  it('uses mean/true nodes separately and verifies published Meeus mean formula anchors', () => {
    close(meanNorthNode(2451545), 125.0445479, 0.001);
    // Swiss independently projects the mean apogee onto the ecliptic (see xval corpus).
    close(meanLilith(2451545), 263.46433272358223, 0.01);
    expect(distance(trueNorthNode(birth.jd!), meanNorthNode(birth.jd!))).toBeGreaterThan(0.1);
    close(
      computePositions(birth.jd!, ['north_node'], { node: 'mean' }).north_node.lon,
      meanNorthNode(birth.jd!),
      1e-10,
    );
    expect(computePositions(birth.jd!, ['mercury']).mercury.retrograde).toBe(true);
  });
  it('returns lunar phase and observer-local solar events, including polar nulls', () => {
    close(
      moonPhase(birth.jd!).angle,
      Astronomy.MoonPhase(new Astronomy.AstroTime(birth.jd! - 2451545)),
      1e-9,
    );
    expect(moonPhase(birth.jd!).name).toBe('waning_gibbous');
    const solar = sunriseSunset(jd('2026-10-03T18:30:00Z'), 28.6139, 77.209);
    expect(solar.sunrise).toBeGreaterThan(jd('2026-10-04T00:40:00Z'));
    expect(solar.sunrise).toBeLessThan(jd('2026-10-04T00:50:00Z'));
    expect(solar.sunset).toBeGreaterThan(solar.sunrise!);
    expect(sunriseSunset(jd('2026-12-21T00:00:00Z'), 89, 0)).toEqual({
      sunrise: null,
      sunset: null,
    });
  });
  it('maps ephemeris failures to the documented error', () => {
    expect(() => astroTime(NaN)).toThrow(expect.objectContaining({ code: 'E_EPHEMERIS' }));
    expect(() => computePositions(NaN, ['sun'])).toThrow(
      expect.objectContaining({ code: 'E_EPHEMERIS' }),
    );
  });
});
