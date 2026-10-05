import { Solar } from 'lunar-typescript';
import { describe, expect, it } from 'vitest';
import { computeBazi, fiveRat, fiveTiger, ganZhiAt, normalizeBirth, STEMS } from '../src';
import { birthClock, startAgeFromMinutes, termTime, toSolar } from '../src/bazi/calendar';
import { chars, now } from './bazi-fixtures';
import A from './fixtures/bazi/A.json';
import B from './fixtures/bazi/B.json';
import C from './fixtures/bazi/C.json';
import D from './fixtures/bazi/D.json';

describe('solar term, late zi and luck boundaries', () => {
  it.each([39, 40, 41])('changes year/month across lichun input minute %i', (minute) => {
    const chart = computeBazi(normalizeBirth({ ...C.input, hour: 20, minute, place: undefined }), {
      now,
      school: { useApparentSolarTime: false },
    });
    expect(chars(chart.pillars.year)).toBe(minute <= 40 ? '己卯' : '庚辰');
    expect(chars(chart.pillars.month)).toBe(minute <= 40 ? '丁丑' : '戊寅');
  });
  it('checks the exact astronomical boundary at one second before/at/after', () => {
    const boundary = Solar.fromYmd(2000, 6, 1).getLunar().getJieQiTable()['立春']!;
    for (const offset of [-1, 0, 1]) {
      const time = termTime(boundary, 'Asia/Shanghai').toPlainDateTime().add({ seconds: offset });
      const lib = toSolar(time).getLunar().getEightChar();
      expect(lib.getYear()).toBe(offset < 0 ? '己卯' : '庚辰');
      expect(lib.getMonth()).toBe(offset < 0 ? '丁丑' : '戊寅');
    }
  });
  it.each([
    ['zi_unified', '丙午'],
    ['zi_split', '乙巳'],
  ] as const)('late zi %s uses expected day and next-day hour on two dates', (ziHour, expected) => {
    for (const day of [2, 3]) {
      const chart = computeBazi(normalizeBirth({ ...B.input, day, hour: 23, minute: 40 }), {
        now,
        school: { ziHour, useApparentSolarTime: false },
      });
      const civil = Solar.fromYmd(1985, 11, day).getLunar();
      const next = Solar.fromYmd(1985, 11, day).next(1).getLunar();
      expect(chars(chart.pillars.day)).toBe(
        (ziHour === 'zi_unified' ? next : civil).getDayInGanZhi(),
      );
      expect(chart.pillars.hour?.stem).toBe(fiveRat(STEMS[next.getDayGanIndex()]!, 'zi'));
      if (day === 2) expect(chars(chart.pillars.day)).toBe(expected);
    }
  });
  it.each([
    [1990, 'male', 'forward'],
    [1985, 'male', 'backward'],
    [1990, 'female', 'backward'],
    [1985, 'female', 'forward'],
  ] as const)('luck direction %i %s is %s', (year, gender, direction) => {
    const birth = normalizeBirth({ ...A.input, year, gender });
    const chart = computeBazi(birth, { now, school: { useApparentSolarTime: false } });
    expect(chart.luck.direction).toBe(direction);
    const t = birthClock(birth, false),
      frame = t.toZonedDateTime(birth.local.tz).withTimeZone('+08:00').toPlainDateTime();
    const solar = toSolar(frame),
      lunar = solar.getLunar(),
      jie = direction === 'forward' ? lunar.getNextJie() : lunar.getPrevJie();
    const mins = Math.abs(jie.getSolar().subtractMinute(solar));
    expect(chart.luck.startAge).toEqual(startAgeFromMinutes(mins));
    const yun = solar
      .getLunar()
      .getEightChar()
      .getYun(gender === 'male' ? 1 : 0, 2);
    expect(chart.luck.startAge).toEqual({
      years: yun.getStartYear(),
      months: yun.getStartMonth(),
      days: yun.getStartDay(),
    });
    const dayun = yun.getDaYun(11).slice(1);
    expect(chart.luck.periods.map((p) => chars(p))).toEqual(dayun.map((p) => p.getGanZhi()));
  });
  it('checks 3 days/year, 1 day/4 months, 1 hour/5 days and truncation', () => {
    expect(startAgeFromMinutes(4320)).toEqual({ years: 1, months: 0, days: 0 });
    expect(startAgeFromMinutes(1440)).toEqual({ years: 0, months: 4, days: 0 });
    expect(startAgeFromMinutes(60)).toEqual({ years: 0, months: 0, days: 5 });
    expect(startAgeFromMinutes(11)).toEqual({ years: 0, months: 0, days: 0 });
  });
  it('selects luck at exact start and ten-year boundaries; no current luck in childhood', () => {
    const birth = normalizeBirth(A.input),
      first = computeBazi(birth, { now });
    const t = birthClock(birth, false).add(first.luck.startAge).toZonedDateTime(birth.local.tz);
    expect(
      computeBazi(birth, { now: t.subtract({ seconds: 1 }) }).luck.periods.some((p) => p.isCurrent),
    ).toBe(false);
    expect(computeBazi(birth, { now: t }).luck.periods[0]?.isCurrent).toBe(true);
    expect(computeBazi(birth, { now: t.add({ years: 10 }) }).luck.periods[1]?.isCurrent).toBe(true);
    expect(
      computeBazi(birth, { now: t.add({ years: 100 }) }).luck.periods.some((p) => p.isCurrent),
    ).toBe(false);
  });
  it('localizes worldwide term boundaries and spans contiguous months across calendar years', () => {
    const birth = normalizeBirth(D.input);
    const boundary = termTime(
      Solar.fromYmd(2000, 6, 1).getLunar().getJieQiTable()['立春']!,
      birth.local.tz,
    );
    for (const delta of [-60, 60]) {
      const t = boundary.add({ seconds: delta });
      const b = normalizeBirth({
        ...D.input,
        year: t.year,
        month: t.month,
        day: t.day,
        hour: t.hour,
        minute: t.minute,
      });
      const chart = computeBazi(b, { now, school: { useApparentSolarTime: false } });
      expect(chars(chart.pillars.year)).toBe(delta < 0 ? '己卯' : '庚辰');
    }
    const chart = computeBazi(birth, { now: '2026-01-01T00:00:00Z' });
    expect(chart.years.find((y) => y.isCurrent)?.year).toBe(2025);
    expect(chart.months[0]?.branch).toBe('yin');
    expect(chart.months[11]?.branch).toBe('chou');
    for (let i = 0; i < 11; i++)
      expect(chart.months[i]?.toDate).toBe(chart.months[i + 1]?.fromDate);
    for (const m of chart.months) expect(m.stem).toBe(fiveTiger(ganZhiAt(2025 - 4).stem, m.branch));
    expect(chart.years.some((y) => y.relationsToLuck.length > 0)).toBe(true);
  });
});
