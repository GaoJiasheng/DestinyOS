import { Temporal } from '@js-temporal/polyfill';
import { Solar, type JieQi } from 'lunar-typescript';
import { SolarTerm, type NormalizedBirth, type BaziChart } from '@tianji/shared';
import {
  ganZhiAt,
  ganZhiIndex,
  STEMS,
  BRANCHES,
  tenGod,
  STEM_YIN_YANG,
  HIDDEN_STEMS,
} from '../common/ganzhi';
import { pairRelations, transitRelations } from './relations';
const TERM_CHARS = [
  '冬至',
  '小寒',
  '大寒',
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
];
// Object enum order is not used; explicit astronomical term order.
const TERM_KEYS: readonly SolarTerm[] = [
  'dong_zhi',
  'xiao_han',
  'da_han',
  'li_chun',
  'yu_shui',
  'jing_zhe',
  'chun_fen',
  'qing_ming',
  'gu_yu',
  'li_xia',
  'xiao_man',
  'mang_zhong',
  'xia_zhi',
  'xiao_shu',
  'da_shu',
  'li_qiu',
  'chu_shu',
  'bai_lu',
  'qiu_fen',
  'han_lu',
  'shuang_jiang',
  'li_dong',
  'xiao_xue',
  'da_xue',
];
/** Converts a library solar clock into an ISO plain date-time without host timezone. */
export function solarPlain(s: Solar): Temporal.PlainDateTime {
  return Temporal.PlainDateTime.from(s.toYmdHms().replace(' ', 'T'));
}
/** Converts a plain clock to the mature lunar calendar API (no Date or system clock). */
export function toSolar(t: Temporal.PlainDateTime): Solar {
  return Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, t.second);
}
/** Library terms use fixed UTC+08, not historical China DST; returns exact instant localized to the requested IANA zone. */
export function termTime(s: Solar, tz: string): Temporal.ZonedDateTime {
  return solarPlain(s).toZonedDateTime('+08:00').withTimeZone(tz);
}
/** Term key and offset-aware ISO timestamp. */
export function termOutput(jie: JieQi, tz: string): BaziChart['solarTerms']['prevJie'] {
  return {
    name: TERM_KEYS[TERM_CHARS.indexOf(jie.getName())]!,
    at: termTime(jie.getSolar(), tz).toString(),
  };
}
/** Selects the effective clock, defaulting unknown time to civil noon without a fictitious hour pillar. */
export function birthClock(birth: NormalizedBirth, useSolar: boolean): Temporal.PlainDateTime {
  const t = useSolar && birth.solarTime.local ? birth.solarTime.local : birth.local;
  return Temporal.PlainDateTime.from({ ...t, hour: t.hour ?? 12, minute: t.minute ?? 0 });
}
/** Synthetic solar/civil clock converted to the library fixed +08 frame for global term boundaries. */
export function termFrame(t: Temporal.PlainDateTime, tz: string): Solar {
  return toSolar(t.toZonedDateTime(tz).withTimeZone('+08:00').toPlainDateTime());
}
/** Precise traditional 3-days/year conversion, integer months and days; remaining sub-day fractions are truncated. */
export function startAgeFromMinutes(minutes: number): BaziChart['luck']['startAge'] {
  const days = Math.floor(minutes / 12);
  return { years: Math.floor(days / 360), months: Math.floor((days % 360) / 30), days: days % 30 };
}
/** Ten real luck periods (童限 appears in debug), using precise start dates for current-period selection. */
export function computeLuck(
  birth: NormalizedBirth,
  t: Temporal.PlainDateTime,
  now: Temporal.ZonedDateTime,
  pillars: BaziChart['pillars'],
): BaziChart['luck'] {
  const forward = (STEM_YIN_YANG[pillars.year.stem] === 'yang') === (birth.gender !== 'female');
  const frame = termFrame(t, birth.local.tz),
    lunar = frame.getLunar();
  const boundary = (forward ? lunar.getNextJie() : lunar.getPrevJie()).getSolar();
  const minutes = Math.abs(boundary.subtractMinute(frame));
  const startAge = startAgeFromMinutes(minutes);
  const start = t.add(startAge).toZonedDateTime(birth.local.tz);
  const monthIndex = ganZhiIndex(
    STEMS[lunar.getMonthGanIndexExact()]!,
    BRANCHES[lunar.getMonthZhiIndexExact()]!,
  );
  // DESIGN-GAP: Age bounds are chronological fractional years [fromAge,toAge); year bounds include any partially covered calendar year, so adjacent periods can share a year.
  const age = startAge.years + startAge.months / 12 + startAge.days / 360;
  const periods = Array.from({ length: 10 }, (_, i) => {
    const pair = ganZhiAt(monthIndex + (forward ? 1 : -1) * (i + 1));
    const from = start.add({ years: i * 10 }),
      until = start.add({ years: (i + 1) * 10 });
    return {
      index: i + 1,
      ...pair,
      fromYear: from.year,
      toYear: until.subtract({ nanoseconds: 1 }).year,
      fromAge: age + i * 10,
      toAge: age + i * 10 + 10,
      tenGod: tenGod(pillars.day.stem, pair.stem),
      branchTenGod: tenGod(pillars.day.stem, HIDDEN_STEMS[pair.branch][0]!),
      isCurrent:
        Temporal.ZonedDateTime.compare(now, from) >= 0 &&
        Temporal.ZonedDateTime.compare(now, until) < 0,
    };
  });
  return {
    direction: forward ? 'forward' : 'backward',
    startAge,
    startDate: start.toPlainDate().toString(),
    periods,
  };
}
/** ±yearsAround around the current 立春 year and 12 exact solar months of that year. */
export function computeTransits(
  now: Temporal.ZonedDateTime,
  yearsAround: number,
  pillars: BaziChart['pillars'],
  luck: BaziChart['luck'],
): Pick<BaziChart, 'years' | 'months'> {
  const frame = termFrame(now.toPlainDateTime(), now.timeZoneId);
  const lichun = Solar.fromYmd(now.year, 6, 1).getLunar().getJieQiTable()['立春']!;
  const currentYear = frame.isBefore(lichun) ? now.year - 1 : now.year;
  const years = Array.from({ length: yearsAround * 2 + 1 }, (_, i) => {
    const year = currentYear - yearsAround + i,
      pair = ganZhiAt(year - 4);
    // DESIGN-GAP: each annual relation uses the luck period active at that year's 立春, or no relation in 童限/outside the 10 periods.
    const spring = termTime(
      Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable()['立春']!,
      now.timeZoneId,
    )
      .toPlainDate()
      .toString();
    const start = Temporal.PlainDate.from(luck.startDate);
    const period = luck.periods.find(
      (_, idx) =>
        Temporal.PlainDate.compare(spring, start.add({ years: idx * 10 })) >= 0 &&
        Temporal.PlainDate.compare(spring, start.add({ years: (idx + 1) * 10 })) < 0,
    );
    return {
      year,
      ...pair,
      tenGod: tenGod(pillars.day.stem, pair.stem),
      relationsToNatal: transitRelations(pair.branch, pillars),
      relationsToLuck: period
        ? pairRelations('year_transit', pair.branch, 'luck', period.branch)
        : [],
      isCurrent: year === currentYear,
    };
  });
  const months = Array.from({ length: 12 }, (_, i) => {
    const anchor = Solar.fromYmd(
      currentYear + (i === 11 ? 1 : 0),
      i === 11 ? 1 : i + 2,
      15,
    ).getLunar();
    const from = anchor.getPrevJie(),
      to = anchor.getNextJie();
    const exact = from.getSolar().nextHour(1).getLunar();
    return {
      index: i + 1,
      stem: STEMS[exact.getMonthGanIndexExact()]!,
      branch: BRANCHES[exact.getMonthZhiIndexExact()]!,
      fromDate: termTime(from.getSolar(), now.timeZoneId).toString(),
      toDate: termTime(to.getSolar(), now.timeZoneId).toString(),
    };
  });
  return { years, months };
}
