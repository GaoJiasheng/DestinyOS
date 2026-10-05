import { Temporal } from '@js-temporal/polyfill';
import { type BirthInput, type DailyChart, type Locale, IanaTimezoneSchema } from '@tianji/shared';
import { normalizeBirth } from '../common/normalize-birth';
import { hashSeed } from '../common/random';
import { EngineError } from '../common/error';
import { tenGod } from '../common/ganzhi';
import { computeBazi } from '../bazi';
import { computeAstrology } from '../astrology/western';
import { drawDaily } from '../tarot';
import { dailyBaziContext } from './index';
import { dailyAstro } from './transits';
import { scoreDaily } from './scoring';
export type DailyRangeDay = { date: string; overall: number; scores: DailyChart['scores'] };
/** Validate an inclusive civil-date range (1900–2100), at most 31 days. */
export function dailyRangeDates(from: string, to: string, tz: string): string[] {
  try {
    IanaTimezoneSchema.parse(tz);
    if (![from, to].every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) throw new Error();
    const start = Temporal.PlainDate.from(from),
      end = Temporal.PlainDate.from(to);
    const days = start.until(end).days;
    if (start.year < 1900 || end.year > 2100 || days < 0 || days > 30) throw new Error();
    return Array.from({ length: days + 1 }, (_, i) => start.add({ days: i }).toString());
  } catch {
    throw new EngineError('E_INVALID_INPUT');
  }
}
/** Calendar-only scores: normalize and compute natal charts once, omit prose/Panchang/almanac work. Seeds match getDailyAction. */
export function computeDailyRange(
  profile: BirthInput,
  from: string,
  to: string,
  tz: string,
  identity: string,
  locale: Locale = 'zh',
): DailyRangeDay[] {
  const dates = dailyRangeDates(from, to, tz),
    birth = normalizeBirth(profile, locale);
  const now = Temporal.PlainDate.from(from)
    .toZonedDateTime({ timeZone: tz, plainTime: '12:00' })
    .toInstant()
    .toString();
  const baziChart = computeBazi(birth, { now, yearsAround: 0 }),
    astroChart = computeAstrology(birth);
  return dates.map((date) => {
    const context = dailyBaziContext({ birth, baziChart, date: { local: date, tz } });
    const drawn = drawDaily(hashSeed(`${identity}|${date}`));
    const { scores } = scoreDaily({
      god: tenGod(baziChart.dayMaster.stem, context.flowDay.stem),
      strength: baziChart.strength.level,
      favorableHit: context.favorableHit,
      unfavorableHit: context.unfavorableHit,
      dayRelations: context.relations,
      secondaryRelations: context.secondaryRelations,
      astro: dailyAstro(date, tz, astroChart, birth.timeUnknown),
      tarot: { card: drawn.cardKey, reversed: drawn.reversed },
    });
    return { date, overall: scores.overall, scores };
  });
}
