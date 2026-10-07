import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import { compute, hashSeed, normalizeBirth } from '@tianji/engine';
import { computeCalendarYear, type CalendarEvent } from '@tianji/engine/calendar';
import { dailyStars } from '@tianji/engine/daily';
import { DailyChartSchema, Locale } from '@tianji/shared';
import { themeColors } from '@tianji/ui-core/tokens';
import type { LocalRecord, Profile, Settings } from '../data/models';
import { getCopy } from '../copy';
import type { MessageKey } from '../i18n';
import { todayIn, domains } from '../daily/service';

// DESIGN-GAP: Widget payload is a versioned allowlist of rendered fields. No profile IDs,
// birth data, chart, account identifiers, tokens or report evidence leave SQLCipher.
export interface WidgetDay {
  startsAt: number;
  expiresAt: number;
  date: string;
  title: string;
  line: string;
  stars: string;
  dimensions: string[];
  color: string;
  colorHex: string;
  numbers: string;
  hours: string;
  card: string;
  cardReversed: boolean;
  cardLabel: string;
  url: 'tianji:///today' | 'tianji:///me/birth';
  background: string;
  foreground: string;
  accent: string;
}
export interface WidgetSnapshot {
  version: 1;
  locale: Settings['locale'];
  stale: string;
  days: WidgetDay[];
}
const hex = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const WidgetSnapshotSchema = z
  .object({
    version: z.literal(1),
    locale: z.enum(['zh', 'zh-TW', 'en']),
    stale: z.string(),
    days: z
      .array(
        z
          .object({
            startsAt: z.number().finite(),
            expiresAt: z.number().finite(),
            date: z.string(),
            title: z.string(),
            line: z.string(),
            stars: z.string(),
            dimensions: z.array(z.string()).max(5),
            color: z.string(),
            colorHex: hex,
            numbers: z.string(),
            hours: z.string(),
            card: z.string(),
            cardReversed: z.boolean(),
            cardLabel: z.string(),
            url: z.enum(['tianji:///today', 'tianji:///me/birth']),
            background: hex,
            foreground: hex,
            accent: hex,
          })
          .strict(),
      )
      .max(8),
  })
  .strict();
export interface Reminder {
  id: string;
  at: number;
  title: string;
  body: string;
  route: '/today' | '/me/birth';
}
const publicBirth = {
  calendar: 'gregorian' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeUnknown: true,
  gender: 'unspecified' as const,
  place: { name: 'UTC', lat: 0, lng: 0, tz: 'UTC' },
};
/** Convert shared 15–95 scores to the same five-star scale used by Today. */
export function stars(score: number) {
  const count = dailyStars(score);
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}
/** Stable 30-day copy rotation across zones and leap years, independent of opens. */
export function guideIndex(date: string) {
  return (
    ((Temporal.PlainDate.from('2026-01-01').until(Temporal.PlainDate.from(date)).days % 30) + 30) %
    30
  );
}
/** Allow only documented local destinations, including cold notification opens. */
export function notificationRoute(value: unknown): Reminder['route'] | null {
  return value === '/today' || value === '/me/birth' ? value : null;
}
/** Select a precomputed current entry; expired personal predictions never masquerade as today's. */
export function currentWidget(snapshot: WidgetSnapshot, now = Date.now()) {
  return snapshot.days.find((day) => day.startsAt <= now && now < day.expiresAt) ?? null;
}
/** Filter exact event endpoints; retrograde intervals remind only for Mercury start/end. */
export function specialEvents(events: CalendarEvent[], date: string, personal: boolean) {
  return events.flatMap<
    CalendarEvent | 'mobile.push.retrogradeStart' | 'mobile.push.retrogradeEnd'
  >((event) => {
    if (event.kind === 'retrograde' && event.detail === 'mercury')
      return [
        ...(event.date === date ? ['mobile.push.retrogradeStart' as const] : []),
        ...(event.endDate === date ? ['mobile.push.retrogradeEnd' as const] : []),
      ];
    const publicEvent = ['solar_term', 'new_moon', 'full_moon'].includes(event.kind);
    const personalEvent =
      personal && ['bazi_luck', 'bazi_year', 'ziwei_year', 'ziwei_decade'].includes(event.kind);
    return event.date === date && (publicEvent || personalEvent) ? [event] : [];
  });
}
/** Build offline seven-day notifications and midnight widget entries in an explicit IANA zone. */
export function planEngagement(
  profile: LocalRecord<Profile> | null,
  settings: Settings,
  now = Temporal.Now.instant().toString(),
  tz = settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  suppliedEvents?: CalendarEvent[],
) {
  const t = getCopy(settings.locale);
  // DESIGN-GAP: Engine-emitted catalog keys are validated against the shared catalog by existing content QA.
  const label = (key: string) => t(key as MessageKey);
  const first = Temporal.PlainDate.from(todayIn(tz, now));
  const birth = profile?.data?.birth ?? publicBirth;
  const normalized = normalizeBirth(birth);
  const last = first.add({ days: 7 });
  const events =
    suppliedEvents ??
    (settings.specialDayReminders
      ? [...new Set([first.year, last.year])].flatMap((year) =>
          computeCalendarYear(birth, year, tz, Locale.zh),
        )
      : []);
  const colors = themeColors(settings.widgetTheme === 'auto' ? 'neutral' : settings.widgetTheme);
  const reminders: Reminder[] = [];
  const days: WidgetDay[] = [];
  let deliveries = 0;
  // Include today + seven following midnight entries; notifications take the next seven future delivery times.
  for (let offset = 0; offset <= 7; offset++) {
    const day = first.add({ days: offset });
    const date = day.toString();
    const midnight = day.toZonedDateTime(tz);
    const chart = DailyChartSchema.parse(
      compute({
        system: 'daily',
        birth: normalized,
        now: day.toZonedDateTime({ timeZone: tz, plainTime: '12:00' }),
        seed: hashSeed(`${profile?.id ?? 'example'}|${date}`),
      }).chart,
    );
    const personal = Boolean(profile?.data);
    const route = personal ? '/today' : '/me/birth';
    const color = label(chart.bazi.luckyColor[0]!);
    const line = personal ? label(chart.oneLiner) : t('mobile.widget.empty');
    days.push({
      startsAt: midnight.epochMilliseconds,
      expiresAt: midnight.add({ days: 1 }).epochMilliseconds,
      date,
      title: t('nav.today'),
      line,
      stars: personal ? stars(chart.scores.overall) : '',
      dimensions: personal
        ? domains.map(
            (domain) => `${label(`daily.dimension.${domain}`)} ${stars(chart.scores[domain])}`,
          )
        : [],
      color: personal ? `${t('daily.lucky.color')} · ${color}` : '',
      colorHex: personal ? chart.bazi.luckyColorHex : colors.accent,
      numbers: personal
        ? `${t('daily.lucky.number')} · ${chart.bazi.luckyNumbers.join(' / ')}`
        : '',
      hours: personal
        ? `${t('daily.lucky.hours')} · ${chart.bazi.goodHours.map((h) => `${h.from}–${h.to}`).join(' / ')}`
        : '',
      card: personal ? chart.tarot.card : '',
      cardReversed: chart.tarot.reversed,
      cardLabel: personal ? t('daily.cardFlip') : '',
      url: personal ? 'tianji:///today' : 'tianji:///me/birth',
      background: colors['bg-0'],
      foreground: colors['text-1'],
      accent: colors.gold,
    });
    const at = day.toZonedDateTime({
      timeZone: tz,
      plainTime: settings.dailyPushTime,
    }).epochMilliseconds;
    if (at <= Temporal.Instant.from(now).epochMilliseconds || deliveries >= 7) continue;
    deliveries++;
    const body = personal
      ? t('mobile.push.body', {
          stars: stars(chart.scores.overall),
          do: chart.doDont.do[0] ? label(chart.doDont.do[0]) : t('mobile.push.none'),
          dont: chart.doDont.dont[0] ? label(chart.doDont.dont[0]) : t('mobile.push.none'),
          color,
        })
      : t('mobile.push.publicSky', {
          sign: label(`charts.sign.${chart.astro.moonSign}`),
          phase: label(`daily.moonPhase.${chart.astro.moonPhase.name}`),
          guide: label(`mobile.push.guide.${String(guideIndex(date)).padStart(2, '0')}`),
        });
    if (settings.dailyPushEnabled)
      reminders.push({
        id: `tianji:daily:${date}`,
        at,
        title: t('mobile.push.title'),
        body,
        route,
      });
    if (settings.specialDayReminders) {
      const notices = specialEvents(events, date, personal).map((event) => {
        if (typeof event === 'string') return t(event);
        return label(
          event.kind === 'solar_term'
            ? `bazi.solarTerms.${event.detail}`
            : `calendar.event.${event.kind}`,
        );
      });
      // DESIGN-GAP: Batch same-day special events at the chosen daily time to avoid notification spam and stay below iOS's 64-request cap.
      if (notices.length)
        reminders.push({
          id: `tianji:special:${date}`,
          at,
          title: t('mobile.push.specialTitle'),
          body: notices.join(' · '),
          route,
        });
    }
  }
  return {
    reminders,
    snapshot: {
      version: 1 as const,
      locale: settings.locale,
      stale: t('mobile.widget.stale'),
      days,
    },
  };
}
