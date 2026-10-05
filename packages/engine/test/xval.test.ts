import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Nakshatra } from '@tianji/shared';
import {
  normalizeBirth,
  computeBazi,
  computeZiwei,
  compute,
  computeQimen,
  computeIching,
  TRIGRAMS,
} from '../src';
import { computePositions } from '../src/astrology/ephemeris';
import { computeAngles, computeHouses } from '../src/astrology/houses';
import { ayanamsaLahiri, nakshatraAt } from '../src/astrology/vedic-rules';
import { vimshottari } from '../src/astrology/dasha';
import { computeVedic } from '../src/astrology/vedic';
import { distance } from '../src/astrology/math';
import { solarTerms, calendarAt } from '../src/common/divination';
import births from './fixtures/xval/births.json';
import edges from './fixtures/xval/term-edges.json';
import casts from './fixtures/xval/casts.json';
import mansions from './fixtures/xval/nakshatra-edges.json';
import manifest from './fixtures/xval/manifest.json';

const NOW = '2026-10-04T07:30:00Z';
const jdOf = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds / 86400000 + 2440587.5;
const pair = (p: { stem: string; branch: string } | null) =>
  p ? { stem: p.stem, branch: p.branch } : null;

// Documentation tolerances: planets 0.1°, axes 0.3°, cusps 0.5°.
const nearAngle = (actual: number, expected: number, tolerance: number) =>
  expect(distance(actual, expected)).toBeLessThanOrEqual(tolerance);

describe('independent Python reference corpus', () => {
  it('has reproducible, geographically and chronologically diverse coverage', () => {
    expect(births).toHaveLength(300);
    expect(casts).toHaveLength(60);
    expect(edges).toHaveLength(192);
    expect(manifest.births).toBe(births.length);
    expect(new Set(births.map((b) => b.id)).size).toBe(300);
    expect(Math.min(...births.map((b) => b.input.year))).toBe(1900);
    expect(Math.max(...births.map((b) => b.input.year))).toBe(2030);
    for (const sign of [-1, 1]) {
      expect(births.some((b) => Math.sign(b.input.place.lat) === sign)).toBe(true);
      expect(births.some((b) => Math.sign(b.input.place.lng) === sign)).toBe(true);
    }
    expect(births.filter((b) => b.input.timeUnknown)).toHaveLength(30);
    expect(births.filter((b) => b.input.hour === 23).length).toBeGreaterThanOrEqual(60);
    expect(
      births.some(
        (b) => b.reference.utc.endsWith('+00:00') && b.input.place.tz === 'America/New_York',
      ),
    ).toBe(true);
  });

  it.each(births)('$id: IANA, solar correction and lunar calendar vs Swiss/sxtwl', (f) => {
    const b = normalizeBirth(f.input);
    expect(b.jd).toBeCloseTo(f.reference.jd, 7);
    expect(jdOf(b.utc!)).toBeCloseTo(jdOf(f.reference.utc), 7);
    const { year, month, day, isLeap } = b.lunar;
    expect({ year, month, day, isLeap }).toEqual(f.reference.lunar);
    if (year >= 1900) {
      const roundTrip = normalizeBirth({
        ...f.input,
        calendar: 'lunar',
        year,
        month,
        day,
        isLeapMonth: isLeap,
      });
      expect(roundTrip.jd).toBeCloseTo(f.reference.jd, 7);
      expect(roundTrip.local).toEqual(b.local);
    }
    if (!b.timeUnknown) {
      // DESIGN-GAP: Meeus and Swiss solar-clock implementations must agree within 0.1 minute; civil output truncates to minute.
      expect(Math.abs(b.solarTime.offsetMinutes! - f.reference.solar.offsetMinutes)).toBeLessThan(
        0.1,
      );
      const actual = Temporal.PlainDateTime.from(b.solarTime.local!).toString();
      const delta = Temporal.PlainDateTime.from(actual)
        .until(f.reference.solar.local)
        .total('minutes');
      expect(Math.abs(delta)).toBeLessThanOrEqual(1);
    }
  });

  it.each([...births, ...edges])('$id: exact four pillars vs sxtwl, both Zi schools', (f) => {
    const b = normalizeBirth(f.input);
    for (const ziHour of ['zi_unified', 'zi_split'] as const) {
      const c = computeBazi(b, { now: NOW, yearsAround: 0, school: { ziHour } });
      const expected = ziHour === 'zi_unified' ? f.reference.pillars : f.reference.splitPillars;
      expect(Object.fromEntries(Object.entries(c.pillars).map(([k, p]) => [k, pair(p)]))).toEqual(
        expected,
      );
      expect(c.luck.direction).toBe(f.reference.luck.direction);
      const age = c.luck.startAge;
      // Minute-resolution jie can straddle one traditional age-day (12 minutes of birth-to-jie distance).
      expect(
        Math.abs(age.years * 360 + age.months * 30 + age.days - f.reference.luck.ageDays),
      ).toBeLessThanOrEqual(1);
      for (const [key, ref] of [
        ['prevJie', f.reference.jie.previous],
        ['nextJie', f.reference.jie.following],
      ] as const) {
        expect(c.solarTerms[key].name).toBe(ref.name);
        expect(
          Math.abs(
            jdOf(Temporal.ZonedDateTime.from(c.solarTerms[key].at).toInstant().toString()) - ref.jd,
          ) * 86400,
        ).toBeLessThan(60);
      }
    }
  });

  it.each(births)('$id: apparent planets, axes, Placidus/Whole Sign and Lahiri vs Swiss', (f) => {
    const j = f.reference.jd;
    const positions = computePositions(j, [
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
      'north_node',
      'lilith',
    ]);
    for (const [key, p] of Object.entries(positions))
      nearAngle(p.lon, f.reference.positions[key as keyof typeof f.reference.positions], 0.1);
    nearAngle(
      computePositions(j, ['north_node'], { node: 'mean' }).north_node.lon,
      f.reference.positions.mean_node,
      0.1,
    );
    // DESIGN-GAP: Lahiri polynomial acceptance uses the 1′ calibration accuracy stated in its implementation.
    nearAngle(ayanamsaLahiri(j), f.reference.ayanamsa, 1 / 60);
    const a = computeAngles(j, f.input.place.lat, f.input.place.lng);
    for (const system of ['placidus', 'whole_sign'] as const) {
      const ref = f.reference.houses[system];
      nearAngle(a.asc, ref.asc, 0.3);
      nearAngle(a.mc, ref.mc, 0.3);
      const cusps = computeHouses(system, a.asc, a.mc, f.input.place.lat, a.obliquity);
      cusps.forEach((c, i) => nearAngle(c, ref.cusps[i]!, 0.5));
    }
  });

  it.each(births)('$id: Moon mansion and Dasha balance vs independent arithmetic', (f) => {
    const moon =
      (computePositions(f.reference.jd, ['moon']).moon.lon - ayanamsaLahiri(f.reference.jd) + 360) %
      360;
    const n = nakshatraAt(moon);
    expect(n.index).toBe(f.reference.moon.index);
    expect(n.pada).toBe(f.reference.moon.pada);
    expect(n.lord).toBe(f.reference.moon.lord);
    const d = vimshottari(f.reference.jd, moon, jdOf(NOW), !f.input.timeUnknown);
    expect(d.sequence[0]!.lord).toBe(f.reference.moon.lord);
    // Propagate documented Moon longitude uncertainty (0.1°) into the starting balance, maximum 20-year lord.
    const bound = (0.1 / (40 / 3)) * 20 * 365.25;
    expect(Math.abs(jdOf(d.sequence[0]!.to) - f.reference.moon.firstEndJD)).toBeLessThan(bound);
    if (f.input.timeUnknown) {
      const c = computeVedic(normalizeBirth(f.input), NOW);
      expect(c.lagna).toBeNull();
      expect(c.houses).toBeNull();
      expect(c.dasha.sequence.every((s) => s.antar.length === 0)).toBe(true);
      expect(c.moon.possibleNakshatras).toEqual(
        f.reference.moon.possibleIndices.map((i) => Nakshatra[i]),
      );
    }
  });

  it.each(births.filter((f) => !f.input.timeUnknown))(
    '$id: Ziwei vs pure Python implementation',
    (f) => {
      const c = computeZiwei({
        birth: normalizeBirth(f.input),
        now: `${f.input.year + 30}-07-01T12:00:00Z`,
      });
      const r = f.reference.ziwei!;
      expect(c.basics.soulPalaceBranch).toBe(r.soul);
      expect(c.basics.bodyPalaceBranch).toBe(r.body);
      expect(c.basics.fiveElementsClass.number).toBe(r.fiveElementsClass);
      for (const p of c.palaces)
        expect(p.majorStars.map((s) => s.key).sort()).toEqual(
          r.majorStars[p.branch as keyof typeof r.majorStars].slice().sort(),
        );
    },
  );

  it('matches every sxtwl solar-term instant to the documented minute precision, including China DST', () => {
    for (const year of [1900, 1988, 2000, 2030]) {
      const actual = solarTerms(year);
      for (const e of edges.filter((f) => f.input.year === year)) {
        const selected = actual.filter((t) => t.name === e.term.name);
        expect(
          Math.min(
            ...selected.map(
              (t) => Math.abs(jdOf(t.time.toInstant().toString()) - e.term.jd) * 86400,
            ),
          ),
        ).toBeLessThan(60);
      }
    }
  });

  it.each(mansions)('Nakshatra boundary $lon: half-open mansion/Pada and Dasha fraction', (r) => {
    const n = nakshatraAt(r.lon);
    expect({ index: n.index, pada: n.pada, lord: n.lord }).toEqual({
      index: r.index,
      pada: r.pada,
      lord: r.lord,
    });
    const d = vimshottari(2451545, r.lon, 2451545);
    expect(d.sequence[0]!.lord).toBe(r.lord);
    expect(jdOf(d.sequence[0]!.to) - 2451545 - r.remainingDays).toBeCloseTo(0, 6);
    expect(d.sequence[0]!.from).toBe('2000-01-01T12:00:00.000Z');
  });

  it('marks actual high-latitude fallback and Zi schools in schoolUsed', () => {
    const f = births.find((f) => Math.abs(f.input.place.lat) > 66 && !f.input.timeUnknown)!;
    const r = compute({ system: 'astrology', birth: normalizeBirth(f.input), now: NOW });
    expect(r.meta.schoolUsed.houseSystem).toBe('whole_sign');
    expect(r.meta.warnings.some((w) => w.code === 'W_HOUSE_SYSTEM_FALLBACK')).toBe(true);
    for (const ziHour of ['zi_unified', 'zi_split'])
      expect(
        compute({
          system: 'bazi',
          birth: normalizeBirth(f.input),
          now: NOW,
          options: { school: { ziHour } },
        }).meta.schoolUsed.ziHour,
      ).toBe(ziHour);
  });
});

const qimenSchool = {
  layout: 'rotating',
  juMethod: 'chaibu',
  centerLodge: 'kun2',
  useApparentSolarTime: false,
} as const;
describe('60 independent divination clocks', () => {
  it.each(casts)('$at: exact calendar and documented three-yuan boundaries', (f) => {
    const t = Temporal.ZonedDateTime.from(f.at),
      ref = f.reference;
    expect(calendarAt(t).pillars).toEqual(ref.pillars);
    const q = computeQimen({ at: f.at, category: 'general', options: { school: qimenSchool } });
    expect(q.dun).toBe(ref.dun);
    expect(q.ju).toBe(ref.ju);
    expect(q.solarTerm.name).toBe(ref.term);
    expect(q.solarTerm.yuan).toBe(ref.yuan);
    const c = computeIching({
      method: 'meihua',
      category: 'other',
      seed: 'xval',
      meihua: { castBy: 'time', at: f.at },
    });
    expect(c.primary.upper).toBe(TRIGRAMS[ref.meihua.upper - 1]);
    expect(c.primary.lower).toBe(TRIGRAMS[ref.meihua.lower - 1]);
    expect(c.movingLines).toEqual([ref.meihua.moving]);
  });
});

const GONG = ['坎', '坤', '震', '巽', '中', '乾', '兌', '艮', '離'];
const STEM_CHARS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const STEM_KEYS = ['jia', 'yi', 'bing', 'ding', 'wu_stem', 'ji', 'geng', 'xin', 'ren', 'gui'];
const STAR_KEYS: Record<string, string> = {
  蓬: 'tian_peng',
  芮: 'tian_rui',
  沖: 'tian_chong',
  輔: 'tian_fu',
  禽: 'tian_rui',
  心: 'tian_xin',
  柱: 'tian_zhu',
  任: 'tian_ren',
  英: 'tian_ying',
};
const GATE_KEYS: Record<string, string> = {
  休: 'xiu',
  死: 'si',
  傷: 'shang',
  杜: 'du',
  開: 'kai',
  驚: 'jing',
  生: 'sheng',
  景: 'jing_view',
};
const DEITY_KEYS: Record<string, string> = {
  符: 'zhi_fu',
  蛇: 'teng_she',
  陰: 'tai_yin',
  合: 'liu_he',
  勾: 'bai_hu',
  虎: 'bai_hu',
  雀: 'xuan_wu',
  玄: 'xuan_wu',
  地: 'jiu_di',
  天: 'jiu_tian',
};
// DESIGN-GAP: kinqimen 0.0.6.6 pan_sky rotates stems incorrectly when the hour stem falls into the center and the xun-head star is Kun2 Rui. These two fixed witnesses must satisfy docs §3.5's star-carried-stem invariant instead.
const REFERENCE_SKY_FAULTS = [
  '2009-07-27T15:32+08:00[Asia/Shanghai]',
  '1906-02-03T06:56+08:00[Asia/Shanghai]',
];
describe('kinqimen independent nine-palace layers, with raw provenance retained', () => {
  it.each(casts)('$at: compares earth, stars, gates, deities and sky to pan(1)', (f) => {
    const c = computeQimen({ at: f.at, category: 'general', options: { school: qimenSchool } });
    const r = f.kinqimenDocumentedJu;
    let skyDifferences = 0;
    for (const p of c.palaces) {
      const g = GONG[p.index - 1]!;
      const earth = r.地盤[g as keyof typeof r.地盤];
      const sky = r.天盤[g as keyof typeof r.天盤];
      expect(p.earthStem).toBe(STEM_KEYS[STEM_CHARS.indexOf(earth)]);
      if (p.index === 5) {
        expect(p.skyStem).toBe(p.earthStem);
        continue;
      }
      const star = STAR_KEYS[r.星[g as keyof typeof r.星]];
      expect(p.star).toBe(star);
      expect(p.gate).toBe(GATE_KEYS[r.門[g as keyof typeof r.門]]);
      expect(p.deity).toBe(DEITY_KEYS[r.神[g as keyof typeof r.神]]);
      if (typeof sky !== 'string') throw new Error('Missing independent sky stem');
      const refStem = STEM_KEYS[STEM_CHARS.indexOf(sky)];
      if (REFERENCE_SKY_FAULTS.includes(f.at)) {
        if (p.skyStem !== refStem) skyDifferences++;
        const home = [
          'tian_peng',
          'tian_rui',
          'tian_chong',
          'tian_fu',
          'tian_qin',
          'tian_xin',
          'tian_zhu',
          'tian_ren',
          'tian_ying',
        ].indexOf(star!);
        expect(p.skyStem).toBe(
          STEM_KEYS[STEM_CHARS.indexOf(r.地盤[GONG[home] as keyof typeof r.地盤])],
        );
        expect(c.palaces[4]!.earthStem).toBe(c.pillars.hour.stem);
        expect(c.zhiFu.palaceEarth).toBe(2);
      } else expect(p.skyStem).toBe(refStem);
    }
    expect(skyDifferences).toBe(REFERENCE_SKY_FAULTS.includes(f.at) ? 8 : 0);
    // Same ju must produce exactly the original raw independent layers; adapters never overwrite raw.
    if (r.排局 === f.kinqimenRaw.排局) expect(r).toEqual(f.kinqimenRaw);
  });
  it('echoes the documented yuan and deity naming rules in metadata', () => {
    const r = compute({ system: 'qimen', now: Temporal.ZonedDateTime.from(casts[0]!.at) });
    expect(r.meta.schoolUsed.yuanBasis).toBe('solar_term_elapsed_days');
    expect(r.meta.schoolUsed.deityNames).toBe('bai_hu_xuan_wu');
  });
});
