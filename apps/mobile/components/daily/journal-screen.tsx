import { corner, nativeTypography, spacing } from '@tianji/ui-core/tokens';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Temporal } from '@js-temporal/polyfill';
import { journalStats, journalStars } from '@tianji/ui-core/journal-stats';
import { useProfiles } from '../../lib/profiles';
import { profileJournal, monthDays, todayIn } from '../../lib/daily/service';
import type { DailyRangeDay } from '@tianji/engine/daily';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { usePreferences } from '../../lib/preferences';
import { Action, CopyText, Page } from '../native-ui';
import { ReportCard } from '../report/report-ui';
import { View, Pressable, Text, useWindowDimensions } from 'react-native';

/** Private per-profile month/list comparison and shared Web long-term reflection statistics. */
export function JournalScreen() {
  // DESIGN-GAP: Large-text month view keeps every date as a full-width row, preserving month/list selection and unrecorded-day navigation.
  const largeText = useWindowDimensions().fontScale > 1.3;
  const t = useCopy(),
    router = useRouter(),
    focused = useIsFocused(),
    locale = usePreferences((s) => s.locale);
  const { active, settings } = useProfiles();
  const { colors, body } = useTheme();
  const tz = settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [month, setMonth] = useState(() => todayIn(tz).slice(0, 7)),
    [mode, setMode] = useState<'month' | 'list'>('month');
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof profileJournal>>>([]),
    [days, setDays] = useState<DailyRangeDay[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [method, setMethod] = useState(false);
  useEffect(() => {
    let alive = true;
    setBusy(Boolean(active));
    setError(false);
    setEntries([]);
    setDays([]);
    const timer = setTimeout(() => {
      if (!active || !focused) return;
      void profileJournal(active.id)
        .then((data) => {
          if (!alive) return;
          setEntries(data);
          setDays(monthDays(active, month, tz, locale));
        })
        .catch(() => {
          if (alive) setError(true);
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 32);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [active, month, tz, locale, retry, focused]);
  const samples = entries.flatMap((entry) =>
      entry.data
        ? [{ date: entry.data.date, mood: entry.data.mood, prediction: entry.data.prediction }]
        : [],
    ),
    stats = journalStats(samples, todayIn(tz));
  const current = entries.filter((entry) => entry.data?.date.startsWith(month)),
    byDate = new Map(current.map((entry) => [entry.data!.date, entry.data!]));
  function navigate(date: string) {
    router.push({ pathname: '/today', params: { date } });
  }
  return (
    <Page title="me.journal">
      <Action label={t('form.birth.back')} onPress={() => router.back()} />
      {!active ? (
        <>
          <CopyText>{t('mobile.profiles.empty')}</CopyText>
          <Action label={t('daily.profileCTA')} onPress={() => router.push('/me/birth')} />
        </>
      ) : (
        <>
          <CopyText>{t('mobile.journal.privacy')}</CopyText>
          {busy && <CopyText>{t('common.loading')}</CopyText>}
          {error && (
            <>
              <CopyText>{t('journal.loadError')}</CopyText>
              <Action label={t('common.retry')} onPress={() => setRetry((n) => n + 1)} />
            </>
          )}
          {!busy && !error && (
            <>
              <ReportCard id="journal-stats">
                <CopyText title>{t('journal.mirror')}</CopyText>
                <CopyText>
                  {t('journal.correlation')} ·{' '}
                  {stats.correlation === null
                    ? t('journal.insufficient')
                    : t('report.content', {
                        text: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
                          stats.correlation,
                        ),
                      })}
                </CopyText>
                <CopyText>
                  {t('journal.streak')} · {t('journal.days', { count: stats.streak })}
                </CopyText>
                <CopyText>
                  {t('journal.longest')} · {t('journal.days', { count: stats.longestStreak })}
                </CopyText>
                <CopyText>{t('journal.domain')}</CopyText>
                {stats.domains.length ? (
                  stats.domains.map((d) => (
                    <CopyText key={d.domain}>
                      {t(`daily.dimension.${d.domain}`)} · {t('journal.hits', { count: d.hits })}
                    </CopyText>
                  ))
                ) : (
                  <CopyText>{t('journal.noHits')}</CopyText>
                )}
                <CopyText>{t('journal.samples', { count: stats.count })}</CopyText>
                <Action label={t('journal.methodLabel')} onPress={() => setMethod(!method)} />
                {method && <CopyText>{t('journal.method')}</CopyText>}
              </ReportCard>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') }}>
                <Action
                  id="journal-prev"
                  disabled={month === '1900-01'}
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
                  id="journal-next"
                  disabled={month === '2100-12'}
                  label={t('calendar.next')}
                  onPress={() =>
                    setMonth(
                      Temporal.PlainDate.from(`${month}-01`)
                        .add({ months: 1 })
                        .toString()
                        .slice(0, 7),
                    )
                  }
                />
              </View>
              <CopyText title>{t('report.content', { text: month })}</CopyText>
              <Action
                id="journal-mode-month"
                selected={mode === 'month'}
                label={t('journal.monthView')}
                onPress={() => setMode('month')}
              />
              <Action
                id="journal-mode-list"
                selected={mode === 'list'}
                label={t('journal.listView')}
                onPress={() => setMode('list')}
              />
              {!current.length && <CopyText>{t('journal.empty')}</CopyText>}
              {mode === 'month' ? (
                <>
                  <CopyText>{t('journal.legend')}</CopyText>
                  <View testID="journal-grid" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {!largeText &&
                      Array.from(
                        { length: Temporal.PlainDate.from(`${month}-01`).dayOfWeek - 1 },
                        (_, i) => <View key={`empty-${i}`} style={{ width: '14.285%' }} />,
                      )}
                    {days.map((day) => {
                      const entry = byDate.get(day.date),
                        forecast = journalStars(entry?.prediction.scores.overall ?? day.overall);
                      return (
                        <Pressable
                          key={day.date}
                          testID={`journal-day-${day.date}`}
                          accessibilityRole="button"
                          accessibilityLabel={t('journal.dayLabel', {
                            date: day.date,
                            forecast,
                            mood: entry ? String(entry.mood) : t('journal.noMood'),
                          })}
                          onPress={() => navigate(day.date)}
                          style={{
                            width: largeText ? '100%' : '14.285%',
                            minHeight: 78,
                            padding: spacing('space-1') / 2,
                          }}
                        >
                          <View
                            style={{
                              flex: 1,
                              borderRadius: corner('r-sm'),
                              borderWidth: entry ? 2 : 1,
                              borderColor: entry ? colors.gold : colors['line-1'],
                              backgroundColor: colors['surface-1'],
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: spacing('space-1'),
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: body,
                                fontSize: nativeTypography.body,
                                color: colors['text-1'],
                              }}
                            >
                              {t('report.content', {
                                text: largeText ? day.date : day.date.slice(-2),
                              })}
                            </Text>
                            <Text
                              style={{
                                fontFamily: body,
                                fontSize: nativeTypography.caption,
                                color: colors.gold,
                              }}
                            >
                              {t('daily.stars', { count: forecast })}
                            </Text>
                            <Text
                              style={{
                                fontFamily: body,
                                fontSize: nativeTypography.caption,
                                color: colors['text-2'],
                              }}
                            >
                              {entry
                                ? t('journal.moodValue', { mood: entry.mood })
                                : t('journal.missingMood')}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                current.map((entry) => (
                  <ReportCard key={entry.id}>
                    <Action
                      label={t('report.content', { text: entry.data!.date })}
                      onPress={() => navigate(entry.data!.date)}
                    />
                    <CopyText>
                      {t('journal.comparison', {
                        forecast: journalStars(entry.data!.prediction.scores.overall),
                        mood: entry.data!.mood,
                      })}
                    </CopyText>
                    <CopyText>{t('report.content', { text: entry.data!.text })}</CopyText>
                  </ReportCard>
                ))
              )}
            </>
          )}
          <Action label={t('calendar.title')} onPress={() => router.push('/today/calendar')} />
        </>
      )}
    </Page>
  );
}
