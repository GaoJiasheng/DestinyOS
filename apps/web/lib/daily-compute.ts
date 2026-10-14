import { Temporal } from '@js-temporal/polyfill';
import { normalizeBirth } from '@tianji/engine/common';
import { computeBazi } from '@tianji/engine/bazi';
import { computeAstrology } from '@tianji/engine/astrology';
import { computeDaily } from '@tianji/engine/daily';
import { ENGINE_VERSION } from '@tianji/engine/version';
import { interpret, type Report } from '@tianji/interpret';
import type { KnowledgeBundle } from '@tianji/content';
import type { BirthInput, DailyChart, Locale } from '@tianji/shared';
export type DailyReport = { chart: DailyChart; report: Report };
/** Compute a daily chart and bilingual knowledge report without network or persistence. */
export function calculateDaily(
  profile: BirthInput,
  date: string,
  tz: string,
  seed: string,
  locale: Locale,
  knowledge: KnowledgeBundle,
): DailyReport {
  const birth = normalizeBirth(profile, locale);
  const now = Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone: tz, plainTime: '12:00' })
    .toInstant()
    .toString();
  const chart = computeDaily({
    birth,
    baziChart: computeBazi(birth, { now }),
    astroChart: computeAstrology(birth),
    vedicChart: null,
    date: { local: date, tz },
    seed,
  });
  return {
    chart,
    report: interpret({
      system: 'daily',
      chart,
      locale,
      knowledge,
      context: { now, profileHasTime: !birth.timeUnknown, engineVersion: ENGINE_VERSION },
    }),
  };
}
export { localToday } from './daily-date';
export { dailyCacheKey, dailyTTL } from './daily-cache-identity';
