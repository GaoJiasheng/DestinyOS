import { corner, nativeTypography, spacing } from '@tianji/ui-core/tokens';
import { useState, useEffect } from 'react';
import { View, Pressable, Text, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Temporal } from '@js-temporal/polyfill';
import { dailyStars, type DailyRangeDay } from '@tianji/engine/daily';
import { computeCalendarYear, type CalendarEvent } from '@tianji/engine/calendar';
import { useProfiles } from '../../lib/profiles';
import { monthDays, todayIn } from '../../lib/daily/service';
import { usePreferences } from '../../lib/preferences';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { Page, CopyText, Action } from '../native-ui';
import { ReportCard, useChartLabel } from '../report/report-ui';

/** Native seven-column heatmap and annual events computed offline by the shared calendar engine. */
export function CalendarScreen() {
  const t = useCopy(),
    label = useChartLabel(),
    router = useRouter(),
    { colors, body } = useTheme();
  const { active, settings } = useProfiles();
  // DESIGN-GAP: Seven columns cannot fit accessibility text; expose full-date rows at large system sizes.
  const largeText = useWindowDimensions().fontScale > 1.3;
  const tz = settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale = usePreferences((s) => s.locale);
  const [month, setMonth] = useState(() => todayIn(tz).slice(0, 7)),
    [days, setDays] = useState<DailyRangeDay[]>([]),
    [events, setEvents] = useState<CalendarEvent[]>([]);
  const [busy, setBusy] = useState(true),
    [yearBusy, setYearBusy] = useState(true),
    [error, setError] = useState(false),
    [yearError, setYearError] = useState(false),
    [retry, setRetry] = useState(0);
  const year = Number(month.slice(0, 4));
  useEffect(() => {
    setDays([]);
    setError(false);
    setBusy(Boolean(active));
    const timer = setTimeout(() => {
      if (!active) return;
      try {
        setDays(monthDays(active, month, tz, locale));
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    }, 32);
    return () => clearTimeout(timer);
  }, [active, month, tz, locale, retry]);
  useEffect(() => {
    setEvents([]);
    setYearError(false);
    setYearBusy(Boolean(active));
    const timer = setTimeout(() => {
      if (!active?.data) return;
      try {
        setEvents(computeCalendarYear(active.data.birth, year, tz, locale));
      } catch {
        setYearError(true);
      } finally {
        setYearBusy(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [active, year, tz, locale, retry]);
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  return (
    <Page title="calendar.title">
      <Action label={t('form.birth.back')} onPress={() => router.back()} />
      {!active ? (
        <>
          <CopyText>{t('calendar.profileRequired')}</CopyText>
          <Action label={t('daily.profileCTA')} onPress={() => router.push('/me/birth')} />
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') }}>
            <Action
              id="calendar-prev"
              disabled={busy || month === '1900-01'}
              label={t('calendar.previous')}
              onPress={() =>
                setMonth(
                  Temporal.PlainDate.from(`${month}-01`)
                    .subtract({ months: 1 })
                    .toString()
                    .slice(0, 7),
                )
              }
            />
            <Action
              id="calendar-next"
              disabled={busy || month === '2100-12'}
              label={t('calendar.next')}
              onPress={() =>
                setMonth(
                  Temporal.PlainDate.from(`${month}-01`).add({ months: 1 }).toString().slice(0, 7),
                )
              }
            />
          </View>
          <CopyText title>
            {t('report.content', {
              text: format(`${month}-01`, { year: 'numeric', month: 'long' }),
            })}
          </CopyText>
          <CopyText>{t('calendar.zone', { zone: tz })}</CopyText>
          {busy && <CopyText>{t('common.loading')}</CopyText>}
          {error && (
            <>
              <CopyText>{t('report.error.E_INTERNAL')}</CopyText>
              <Action label={t('common.retry')} onPress={() => setRetry((n) => n + 1)} />
            </>
          )}
          {!busy && !error && (
            <View testID="calendar-grid" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {!largeText &&
                Array.from({ length: 7 }, (_, i) => (
                  <View
                    key={`week-${i}`}
                    style={{
                      width: '14.285%',
                      alignItems: 'center',
                      paddingVertical: spacing('space-2'),
                    }}
                  >
                    <CopyText>
                      {t('report.content', {
                        text: format(`2026-10-${String(5 + i).padStart(2, '0')}`, {
                          weekday: 'short',
                        }),
                      })}
                    </CopyText>
                  </View>
                ))}
              {!largeText &&
                Array.from(
                  { length: Temporal.PlainDate.from(`${month}-01`).dayOfWeek - 1 },
                  (_, i) => <View key={`empty-${i}`} style={{ width: '14.285%' }} />,
                )}
              {days.map((day) => (
                <Pressable
                  key={day.date}
                  testID={`calendar-day-${day.date}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.dayLabel', {
                    date: format(day.date, { dateStyle: 'full' }),
                    score: day.overall,
                  })}
                  style={{
                    width: largeText ? '100%' : '14.285%',
                    minHeight: 58,
                    padding: spacing('space-1') / 2,
                  }}
                  onPress={() => router.push({ pathname: '/today', params: { date: day.date } })}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: corner('r-sm'),
                      backgroundColor: `${colors.gold}${Math.round(dailyStars(day.overall) * 51)
                        .toString(16)
                        .padStart(2, '0')}`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: body,
                        fontSize: nativeTypography.h3,
                        color: dailyStars(day.overall) >= 3 ? colors['bg-0'] : colors['text-1'],
                      }}
                    >
                      {largeText
                        ? t('calendar.dayLabel', {
                            date: format(day.date, { dateStyle: 'full' }),
                            score: day.overall,
                          })
                        : t('report.content', { text: day.date.slice(-2) })}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <CopyText>{t('mobile.calendar.legend')}</CopyText>
          <ReportCard>
            <CopyText title>{t('calendar.annual', { year })}</CopyText>
            <CopyText>{t('calendar.boundaries')}</CopyText>
            {active.data?.birth.timeUnknown && <CopyText>{t('calendar.unknownTime')}</CopyText>}
            {yearBusy && <CopyText>{t('common.loading')}</CopyText>}
            {yearError && (
              <>
                <CopyText>{t('report.error.E_INTERNAL')}</CopyText>
                <Action label={t('common.retry')} onPress={() => setRetry((n) => n + 1)} />
              </>
            )}
            {!yearBusy && !yearError && !events.length && (
              <CopyText>{t('calendar.empty')}</CopyText>
            )}
            {events.map((e) => (
              <View key={`${e.kind}:${e.at}`}>
                <Action
                  label={`${format(e.date, { month: 'short', day: 'numeric' })} · ${label(`calendar.event.${e.kind}`, undefined, { detail: e.detail ? label(`${e.kind === 'solar_term' ? 'home.term' : e.kind === 'retrograde' ? 'charts.planet' : 'charts.graha'}.${e.detail}`) : '' })}`}
                  onPress={() =>
                    router.push({
                      pathname: '/today',
                      params: { date: e.date < `${year}-01-01` ? `${year}-01-01` : e.date },
                    })
                  }
                />
                <CopyText>{label(`calendar.explanation.${e.kind}`)}</CopyText>
              </View>
            ))}
          </ReportCard>
        </>
      )}
    </Page>
  );
}
