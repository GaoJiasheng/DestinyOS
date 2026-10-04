import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { Temporal } from '@js-temporal/polyfill';
import {
  Aspect,
  Planet,
  AstroChartSchema,
  VedicChartSchema,
  type AstroChart,
  type Body,
  type Graha,
  type VedicChart,
} from '@tianji/shared';
import {
  compute,
  normalizeBirth,
  computePositions,
  computeAstrology,
  computeVedic,
  computeAngles,
  computeHouses,
  gmst,
  lst,
  houseAt,
  aspects,
  aspectPatterns,
  DEFAULT_ORBS,
  ASPECT_ANGLES,
  moonPhase,
  meanNorthNode,
  trueNorthNode,
  meanLilith,
  sunriseSunset,
  astroTime,
  ayanamsaLahiri,
  nakshatraAt,
  navamsaSign,
  dignity,
  combust,
  vimshottari,
  jdToISO,
  YEAR_DAYS,
  chartStats,
  mutualReceptions,
  TRADITIONAL_RULERS,
  detectYogas,
  YOGA_CONDITIONS,
  computePanchang,
  karanaKey,
  wrap,
  signed,
  distance,
} from '../src';
import A from './fixtures/birth/A.json';
import D from './fixtures/birth/D.json';
import E from './fixtures/birth/E.json';
import goldenA from './fixtures/astrology/A.json';
import delhi from './fixtures/astrology/new-delhi-2026-10-04.json';
const birth = normalizeBirth(A),
  now = '2026-10-04T00:00:00Z';
const pos = (lon: number, speed = 1) => ({ lon, lat: 0, speed, retrograde: speed < 0 });
const jd = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds / 86400000 + 2440587.5;
const close = (actual: number, expected: number, tolerance: number) =>
  expect(distance(actual, expected)).toBeLessThanOrEqual(tolerance);

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
    close(meanLilith(2451545), 263.3532465, 0.001);
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

describe('all nine aspects and inclusive orb boundaries', () => {
  it.each(Object.values(Aspect))('%s matches exact and both orb edges; rejects outside', (type) => {
    const target = ASPECT_ANGLES[type],
      orb = DEFAULT_ORBS[type];
    for (const lon of [target, target + orb, target - orb].filter((x) => x >= 0 && x <= 180))
      expect(aspects({ mercury: pos(0, 0), venus: pos(lon) }).some((a) => a.type === type)).toBe(
        true,
      );
    const lon = target === 180 ? target - orb - 0.0001 : target + orb + 0.0001;
    expect(aspects({ mercury: pos(0, 0), venus: pos(lon) }).some((a) => a.type === type)).toBe(
      false,
    );
  });
  it('adds the luminary bonus once, permits custom orbs and assigns major flags', () => {
    expect(
      aspects({ sun: pos(0), moon: pos(10) }).find((a) => a.type === 'conjunction'),
    ).toBeDefined();
    expect(
      aspects({ sun: pos(0), moon: pos(10.001) }).find((a) => a.type === 'conjunction'),
    ).toBeUndefined();
    expect(aspects({ mercury: pos(0), venus: pos(3) }, { conjunction: 2 })).toEqual([]);
    expect(aspects({ mercury: pos(0), venus: pos(30) })[0]?.major).toBe(false);
    expect(aspects({ mercury: pos(0), venus: pos(60) })[0]?.major).toBe(true);
  });
  it.each([
    [0, 91, -1, true],
    [0, 91, 1, false],
    [359, 1, -1, true],
    [359, 1, 1, false],
    [0, 179, 1, true],
    [0, 179, -1, false],
    [0, 90, 1, false],
    [0, 91, 0, false],
  ])('signed applying at %s / %s with relative velocity %s', (a, b, speed, expected) => {
    expect(
      aspects({ mercury: pos(a as number, 0), venus: pos(b as number, speed as number) })[0]
        ?.applying,
    ).toBe(expected);
  });
  it.each([
    ['grand_trine', [0, 120, 240]],
    ['t_square', [0, 90, 180]],
    ['grand_cross', [0, 90, 180, 270]],
    ['kite', [0, 120, 240, 180]],
    ['yod', [0, 60, 210]],
  ] as const)('detects and deduplicates %s', (key, lons) => {
    const keys: Body[] = ['mercury', 'venus', 'mars', 'jupiter'],
      p: Partial<Record<Body, ReturnType<typeof pos>>> = {};
    lons.forEach((lon, i) => {
      p[keys[i]!] = pos(lon);
    });
    const patterns = aspectPatterns(aspects(p)).filter((x) => x.key === key);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.bodies).toHaveLength(lons.length);
    expect(aspectPatterns(aspects({ mercury: pos(0), venus: pos(10), mars: pos(20) }))).toEqual([]);
  });
});

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

describe('Vedic sidereal divisions, dignity and combustion', () => {
  it('Lahiri 2000-01-01 is 23°51′ within 1′ and 1990 is about 23°43′', () => {
    close(ayanamsaLahiri(2451544.5), 23 + 51 / 60, 1 / 60);
    close(ayanamsaLahiri(birth.jd!), 23 + 43 / 60, 1 / 60);
  });
  it.each(Array.from({ length: 27 }, (_, i) => i))(
    'Nakshatra %s has four padas and a repeating lord',
    (index) => {
      for (let pada = 1; pada <= 4; pada++) {
        const lon = (index * 40) / 3 + ((pada - 0.5) * 10) / 3,
          n = nakshatraAt(lon);
        expect(n.index).toBe(index);
        expect(n.pada).toBe(pada);
        expect(n.lord).toBe(
          ['ketu', 'shukra', 'surya', 'chandra', 'mangala', 'rahu', 'guru', 'shani', 'budha'][
            index % 9
          ],
        );
      }
    },
  );
  it.each([
    ['aries', 0],
    ['capricorn', 30],
    ['libra', 60],
    ['cancer', 90],
  ] as const)('D9 starts at %s for longitude %s', (sign, lon) => {
    expect(navamsaSign(lon)).toBe(sign);
    expect(navamsaSign(lon + 3.4)).not.toBe(sign);
    expect(navamsaSign(lon + 360)).toBe(sign);
  });
  it.each([
    ['surya', 10, 'exalted'],
    ['surya', 190, 'debilitated'],
    ['surya', 125, 'moolatrikona'],
    ['surya', 145, 'own'],
    ['chandra', 31, 'exalted'],
    ['chandra', 35, 'moolatrikona'],
    ['chandra', 95, 'own'],
    ['chandra', 215, 'debilitated'],
    ['mangala', 275, 'exalted'],
    ['mangala', 5, 'moolatrikona'],
    ['mangala', 15, 'own'],
    ['mangala', 95, 'debilitated'],
    ['budha', 155, 'exalted'],
    ['budha', 167, 'moolatrikona'],
    ['budha', 175, 'own'],
    ['budha', 335, 'debilitated'],
    ['guru', 95, 'exalted'],
    ['guru', 245, 'moolatrikona'],
    ['guru', 255, 'own'],
    ['guru', 275, 'debilitated'],
    ['shukra', 335, 'exalted'],
    ['shukra', 185, 'moolatrikona'],
    ['shukra', 205, 'own'],
    ['shukra', 155, 'debilitated'],
    ['shani', 185, 'exalted'],
    ['shani', 305, 'moolatrikona'],
    ['shani', 325, 'own'],
    ['shani', 5, 'debilitated'],
    ['surya', 35, 'enemy'],
    ['surya', 65, 'neutral'],
    ['surya', 95, 'friend'],
    ['rahu', 35, 'neutral'],
    ['ketu', 155, 'neutral'],
  ] as const)('%s at %s° is %s', (body, lon, expected) =>
    expect(dignity(body, lon)).toBe(expected),
  );
  it.each([
    ['chandra', 12, false],
    ['mangala', 17, false],
    ['budha', 14, false],
    ['budha', 12, true],
    ['guru', 11, false],
    ['shukra', 10, false],
    ['shukra', 8, true],
    ['shani', 15, false],
  ] as const)('%s combustion threshold %s retro %s', (body, limit, retro) => {
    expect(combust(body, limit - 0.001, 0, retro)).toBe(true);
    expect(combust(body, limit, 0, retro)).toBe(false);
    expect(combust(body, 360 - limit + 0.001, 0, retro)).toBe(true);
  });
  it('Sun and nodes are never combust', () => {
    for (const body of ['surya', 'rahu', 'ketu'] as const)
      expect(combust(body, 0, 0, false)).toBe(false);
  });
});

describe('Vimshottari hand calculations and horizon', () => {
  it('Rohini pada 2 at 45° has 5/8 of the ten-year Moon Maha remaining', () => {
    // Rohini 40°..53°20′, 45° is 3/8 elapsed. Original Maha begins 3.75 years before birth.
    const birth = 2451545,
      d = vimshottari(birth, 45, birth),
      first = d.sequence[0]!;
    expect(nakshatraAt(45)).toMatchObject({ nakshatra: 'rohini', pada: 2, lord: 'chandra' });
    expect(first.lord).toBe('chandra');
    expect(first.from).toBe(jdToISO(birth));
    expect(first.to).toBe(jdToISO(birth + 6.25 * 365.25));
    expect(first.current).toBe(true);
    // After Moon 10/12 year, Mars 7/12, Rahu 18/12, Jupiter 16/12: 4.25 years elapsed. Birth at 3.75 is Jupiter Antar.
    expect(first.antar[0]!.lord).toBe('guru');
    expect(first.antar[0]!.to).toBe(jdToISO(birth + 0.5 * 365.25));
    expect(first.antar[0]!.current).toBe(true);
    expect(d.sequence[1]!.lord).toBe('mangala');
    expect(d.sequence[1]!.to).toBe(jdToISO(birth + 13.25 * 365.25));
  });
  it('starts at Ketu at Ashwini zero; nine Antar durations sum exactly to their Maha', () => {
    const d = vimshottari(2451545, 0, 2451545),
      first = d.sequence[0]!;
    expect(first.lord).toBe('ketu');
    expect(first.antar).toHaveLength(9);
    expect(first.antar[0]!.to).toBe(jdToISO(2451545 + ((7 * 7) / 120) * YEAR_DAYS));
    for (let i = 0; i < d.sequence.length; i++) {
      const m = d.sequence[i]!;
      expect(m.antar[0]!.from).toBe(m.from);
      expect(m.antar.at(-1)!.to).toBe(m.to);
      if (i) expect(m.from).toBe(d.sequence[i - 1]!.to);
      for (let j = 1; j < m.antar.length; j++) expect(m.antar[j]!.from).toBe(m.antar[j - 1]!.to);
    }
    expect(d.sequence.at(-1)!.to).toBe(jdToISO(2451545 + 120 * YEAR_DAYS));
  });
  it('selects exactly one current Maha/Antar at a boundary and zero outside the horizon', () => {
    const b = 2451545,
      d = vimshottari(b, 0, b + 7 * YEAR_DAYS);
    expect(d.sequence.filter((m) => m.current).map((m) => m.lord)).toEqual(['shukra']);
    expect(d.sequence.flatMap((m) => m.antar).filter((a) => a.current)).toHaveLength(1);
    expect(vimshottari(b, 0, b - 1).sequence.some((m) => m.current)).toBe(false);
    expect(vimshottari(b, 0, b + 121 * YEAR_DAYS).sequence.some((m) => m.current)).toBe(false);
    expect(vimshottari(b, 45, b, false).sequence.every((m) => !m.antar.length)).toBe(true);
  });
});

describe('all twelve Yoga predicates: positive and negative examples', () => {
  const template = computeVedic(birth, now),
    lagna = {
      sidLon: 0,
      sign: 'aries' as const,
      nakshatra: 'ashwini' as const,
      pada: 1,
      navamsaSign: 'aries' as const,
    };
  function bodies(
    overrides: Partial<Record<Graha, Partial<VedicChart['bodies'][number]>>>,
  ): VedicChart['bodies'] {
    return template.bodies.map((b) => ({
      ...b,
      sign: 'gemini',
      house: 3,
      dignity: 'neutral',
      ...overrides[b.key],
    }));
  }
  const cases: Record<
    keyof typeof YOGA_CONDITIONS,
    {
      positive: Partial<Record<Graha, Partial<VedicChart['bodies'][number]>>>;
      negative: Partial<Record<Graha, Partial<VedicChart['bodies'][number]>>>;
    }
  > = {
    gajakesari: {
      positive: { chandra: { sign: 'aries' }, guru: { sign: 'cancer' } },
      negative: { chandra: { sign: 'aries' }, guru: { sign: 'taurus' } },
    },
    budha_aditya: {
      positive: { surya: { sign: 'aries' }, budha: { sign: 'aries' } },
      negative: { surya: { sign: 'aries' }, budha: { sign: 'taurus' } },
    },
    chandra_mangala: {
      positive: { chandra: { sign: 'aries' }, mangala: { sign: 'aries' } },
      negative: { chandra: { sign: 'aries' }, mangala: { sign: 'taurus' } },
    },
    ruchaka: {
      positive: { mangala: { house: 1, dignity: 'own' } },
      negative: { mangala: { house: 3, dignity: 'own' } },
    },
    bhadra: {
      positive: { budha: { house: 4, dignity: 'exalted' } },
      negative: { budha: { house: 4, dignity: 'enemy' } },
    },
    hamsa: {
      positive: { guru: { house: 7, dignity: 'moolatrikona' } },
      negative: { guru: { house: 6, dignity: 'own' } },
    },
    malavya: {
      positive: { shukra: { house: 10, dignity: 'own' } },
      negative: { shukra: { house: 2, dignity: 'own' } },
    },
    shasha: {
      positive: { shani: { house: 1, dignity: 'own' } },
      negative: { shani: { house: 1, dignity: 'debilitated' } },
    },
    raja_yoga: {
      positive: {},
      negative: {
        mangala: { sign: 'aries' },
        surya: { sign: 'leo' },
        guru: { sign: 'sagittarius' },
        chandra: { sign: 'cancer' },
        shukra: { sign: 'taurus' },
        shani: { sign: 'capricorn' },
      },
    },
    dhana_yoga: {
      positive: {},
      negative: {
        shukra: { sign: 'taurus' },
        shani: { sign: 'capricorn' },
        surya: { sign: 'leo' },
        guru: { sign: 'sagittarius' },
      },
    },
    kemadruma: {
      positive: { chandra: { sign: 'aries' } },
      negative: { chandra: { sign: 'aries' }, mangala: { sign: 'taurus' } },
    },
    neecha_bhanga: {
      positive: { surya: { sign: 'libra', dignity: 'debilitated' }, shukra: { house: 4 } },
      negative: { surya: { sign: 'libra', dignity: 'debilitated' }, shukra: { house: 3 } },
    },
  };
  it.each(Object.keys(YOGA_CONDITIONS) as (keyof typeof YOGA_CONDITIONS)[])(
    '%s detects positive and rejects negative',
    (key) => {
      expect(detectYogas(bodies(cases[key].positive), lagna).map((y) => y.key)).toContain(key);
      expect(detectYogas(bodies(cases[key].negative), lagna).map((y) => y.key)).not.toContain(key);
      expect(YOGA_CONDITIONS[key]).toBeTruthy();
    },
  );
  it('noon charts retain sign-only yogas with empty house evidence', () => {
    const result = detectYogas(
      bodies({ surya: { sign: 'aries' }, budha: { sign: 'aries' } }).map((b) => ({
        ...b,
        house: null,
      })),
      null,
    );
    expect(result.some((y) => y.key === 'budha_aditya')).toBe(true);
    expect(result.every((y) => y.houses.length === 0)).toBe(true);
    expect(result.some((y) => ['raja_yoga', 'dhana_yoga', 'neecha_bhanga'].includes(y.key))).toBe(
      false,
    );
  });
});

describe('Panchang reference and transition root solving', () => {
  it('matches Drik Panchang 2026-10-04 New Delhi: Navami, Punarvasu→Pushya, Parigha→Shiva, Taitila→Garaja', () => {
    // docs/appendix/research-competitors.md records the Drik provider/fields (its example location is Houston).
    // Date/location reference: https://www.drikpanchang.com/panchang/month-panchang.html?geoname-id=1273294&date=04/10/2026
    // Independently verified reference ends: Navami Oct 5 03:53 IST; Punarvasu Oct 5 00:13 IST; Parigha Oct 4 12:32 IST.
    const p = computePanchang(delhi.date, delhi.place);
    expect(p.tithi).toMatchObject({ index: 24, key: 'navami' });
    expect(p.nakshatra.key).toBe('punarvasu');
    expect(p.yoga.key).toBe('parigha');
    expect(p.karana.key).toBe('taitila');
    expect(p.vara.key).toBe('raviwara');
    expect(p.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ limb: 'nakshatra', key: 'pushya' }),
        expect.objectContaining({ limb: 'yoga', key: 'shiva' }),
        expect.objectContaining({ limb: 'karana', key: 'garaja' }),
      ]),
    );
    // DESIGN-GAP: Panchang minute tolerance is unspecified; adopt 3 minutes for independent end-time references at ±1′ ephemeris precision.
    for (const [actual, reference] of [
      [p.tithi.endsAt, delhi.tithi.endsAt],
      [p.nakshatra.endsAt, delhi.nakshatra.endsAt],
      [p.yoga.endsAt, delhi.yoga.endsAt],
    ])
      expect(Math.abs(jd(actual!) - jd(reference!)) * 1440).toBeLessThan(delhi.toleranceMinutes);
    for (const change of p.transitions) {
      expect(change.endsAt > change.startsAt).toBe(true);
      expect(change.startsAt > p.sunrise!).toBe(true);
      expect(change.startsAt < p.vara.endsAt).toBe(true);
    }
  });
  it.each(Array.from({ length: 60 }, (_, i) => i))('maps Karana half-tithi %s', (index) => {
    const expected =
      index === 0
        ? 'kimstughna'
        : index >= 57
          ? ['shakuni', 'chatushpada', 'naga'][index - 57]
          : ['bava', 'balava', 'kaulava', 'taitila', 'garaja', 'vanija', 'vishti'][(index - 1) % 7];
    expect(karanaKey(index)).toBe(expected);
  });
  it.each(['2026-10-10', '2026-10-25', '2026-10-26', '2026-12-21'])(
    'solves every limb at a boundary including lunar cycle wrap: %s',
    (date) => {
      const p = computePanchang(date, { lat: 28.6139, lng: 77.209, tz: 'Asia/Kolkata' });
      for (const limb of ['tithi', 'nakshatra', 'yoga', 'karana'] as const) {
        const t = jd(p[limb].endsAt),
          before = computePositions(t - 1 / 86400, ['sun', 'moon']),
          after = computePositions(t + 1 / 86400, ['sun', 'moon']);
        const angle = (positions: typeof before, time: number) =>
          limb === 'tithi' || limb === 'karana'
            ? wrap(positions.moon.lon - positions.sun.lon)
            : limb === 'nakshatra'
              ? wrap(positions.moon.lon - ayanamsaLahiri(time))
              : wrap(positions.sun.lon + positions.moon.lon - 2 * ayanamsaLahiri(time));
        const width = limb === 'tithi' ? 12 : limb === 'karana' ? 6 : 40 / 3;
        expect(Math.floor(angle(before, t - 1 / 86400) / width)).not.toBe(
          Math.floor(angle(after, t + 1 / 86400) / width),
        );
      }
    },
  );
  it('uses previous sunrise Vara for pre-dawn birth and explicit polar-midnight fallback', () => {
    const place = { lat: 28.6139, lng: 77.209, tz: 'Asia/Kolkata' },
      before = computePanchang('2026-10-04', place, jd('2026-10-03T22:00:00Z'));
    expect(before.date).toBe('2026-10-03');
    expect(before.vara.key).toBe('shaniwara');
    const polar = computePanchang('2026-12-21', { lat: 89, lng: 0, tz: 'UTC' });
    expect(polar.sunrise).toBeNull();
    expect(polar.sunset).toBeNull();
    expect(polar.vara.endsAt).toBe('2026-12-22T00:00:00.000Z');
    expect(() => computePanchang('bad', place)).toThrow(
      expect.objectContaining({ code: 'E_INVALID_INPUT' }),
    );
  });
});

describe('exact division boundaries and mutual reception', () => {
  it.each(Array.from({ length: 108 }, (_, i) => i))(
    'D9/Pada boundary %s belongs to the following division',
    (i) => {
      const lon = (i * 10) / 3,
        signs = [
          'aries',
          'taurus',
          'gemini',
          'cancer',
          'leo',
          'virgo',
          'libra',
          'scorpio',
          'sagittarius',
          'capricorn',
          'aquarius',
          'pisces',
        ];
      expect(navamsaSign(lon)).toBe(signs[i % 12]);
      expect(navamsaSign(lon + 1e-8)).toBe(signs[i % 12]);
      expect(navamsaSign(lon - 1e-8)).toBe(signs[(i + 11) % 12]);
      expect(nakshatraAt(lon).index).toBe(Math.floor(i / 4));
      expect(nakshatraAt(lon).pada).toBe((i % 4) + 1);
      if (i % 4 === 0) {
        const d = vimshottari(2451545, lon, 2451545);
        expect(d.sequence[0]!.antar[0]!.lord).toBe(nakshatraAt(lon).lord);
        expect(d.sequence[0]!.from).toBe('2000-01-01T12:00:00.000Z');
      }
    },
  );
});

it('mutual receptions use modern and traditional domicile rulers, no false self-receptions', () => {
  expect(
    mutualReceptions([
      { key: 'mercury', sign: 'taurus' },
      { key: 'venus', sign: 'gemini' },
    ]),
  ).toEqual([['mercury', 'venus']]);
  const pair = [
    { key: 'mars' as const, sign: 'aquarius' as const },
    { key: 'saturn' as const, sign: 'scorpio' as const },
  ];
  expect(mutualReceptions(pair)).toEqual([]);
  expect(mutualReceptions(pair, TRADITIONAL_RULERS)).toEqual([['mars', 'saturn']]);
  expect(
    mutualReceptions([
      { key: 'mercury', sign: 'gemini' },
      { key: 'venus', sign: 'taurus' },
    ]),
  ).toEqual([]);
});
