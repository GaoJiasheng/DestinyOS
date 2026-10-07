import { NativeAdCard } from '../native-ad-card';
import { spacing, corner } from '@tianji/ui-core/tokens';
import { useState, useRef } from 'react';
import { ScrollView, View, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView, BlurTargetView } from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Temporal } from '@js-temporal/polyfill';
import { dailyStars } from '@tianji/engine/daily';
import { dailyExcerpt } from '@tianji/ui-core/daily-excerpt';
import { useCopy } from '../../lib/copy';
import { useChartLabel, ReportCard } from '../report/report-ui';
import { usePreferences } from '../../lib/preferences';
import { useTheme } from '../../lib/theme';
import { useDaily } from '../../lib/daily/use-daily';
import { domains, todayIn } from '../../lib/daily/service';
import { Action, CopyText } from '../native-ui';
import { SkyHero } from './sky-hero';
import { JournalEditor } from './journal-editor';
import { DailyShare } from './daily-share';
import { NotificationHint } from './notification-hint';
import { DailyStars } from './stars';
import { DailyInsights } from './daily-insights';

/** Thirteen documented daily blocks with native swipe, refresh, card flip and private reflection. */
export function TodayScreen() {
  const { date: requested } = useLocalSearchParams<{ date?: string }>();
  const { active, tz, date, setDate, value, busy, error, refresh } = useDaily(requested);
  const t = useCopy(),
    label = useChartLabel(),
    router = useRouter(),
    { colors } = useTheme();
  const locale = usePreferences((s) => s.locale);
  const [share, setShare] = useState(false),
    [skyVisible, setSkyVisible] = useState(true);
  const chart = value?.chart;
  function switchDay(delta: number) {
    const next = Temporal.PlainDate.from(date).add({ days: delta }).toString();
    if (
      next >= '1900-01-01' &&
      next <= Temporal.PlainDate.from(todayIn(tz)).add({ days: 1 }).toString()
    )
      setDate(next);
  }
  const excerpt = (key: string) => {
    const section = value?.report.sections.find((s) => s.key === key);
    const block = section?.blocks.find((b) => b.type === 'paragraph');
    return block?.type === 'paragraph'
      ? t('report.content', {
          text: dailyExcerpt(block.text, locale, (term) => label(`glossary.${term}.term`)),
        })
      : '';
  };
  const sectionTitle = (key: string) => label(`report.sections.daily.${key}`);
  const sampleTarget = useRef<View>(null);
  const touch = useRef<{ x: number; y: number } | undefined>(undefined);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors['bg-0'] }}>
      <ScrollView
        testID="today-scroll"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // DESIGN-GAP: Conservatively pause hero motion after 400pt of scrolling; wide layouts may pause before the entire hero exits.
        onScroll={(e) => setSkyVisible(e.nativeEvent.contentOffset.y < 400)}
        scrollEventThrottle={160}
        refreshControl={
          <RefreshControl refreshing={busy} onRefresh={refresh} tintColor={colors.gold} />
        }
        contentContainerStyle={{ padding: spacing('space-6'), gap: spacing('space-5') }}
      >
        <NotificationHint />
        <SkyHero visible={skyVisible} />
        <CopyText title>{t('nav.today')}</CopyText>
        <View
          testID="daily-block-1"
          onTouchStart={(e) => {
            touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          }}
          onTouchEnd={(e) => {
            // DESIGN-GAP: Date-header swipes require 60pt horizontally and less than 50pt vertically to distinguish scrolling.
            if (
              touch.current &&
              Math.abs(e.nativeEvent.pageX - touch.current.x) > 60 &&
              Math.abs(e.nativeEvent.pageY - touch.current.y) < 50
            )
              switchDay(e.nativeEvent.pageX < touch.current.x ? 1 : -1);
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') }}>
            <Action
              id="daily-prev"
              label={t('daily.yesterday')}
              disabled={busy || date === '1900-01-01'}
              onPress={() => switchDay(-1)}
            />
            <Action id="daily-now" label={t('daily.today')} onPress={() => setDate(todayIn(tz))} />
            <Action
              id="daily-next"
              label={t('daily.tomorrow')}
              disabled={busy || date > todayIn(tz)}
              onPress={() => switchDay(1)}
            />
          </View>
          <CopyText testID="daily-date">
            {t('report.content', {
              text: new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
                new Date(`${date}T12:00:00Z`),
              ),
            })}
          </CopyText>
          {chart && (
            <>
              <CopyText>
                {t('daily.lunar', {
                  year: chart.date.lunar.year,
                  month: chart.date.lunar.month,
                  day: chart.date.lunar.day,
                })}
              </CopyText>
              <CopyText>
                {t('report.content', {
                  text: Object.values(chart.date.ganZhi)
                    .map(
                      (g) =>
                        `${label(`bazi.stems.${g.stem}`)}${label(`bazi.branches.${g.branch}`)}`,
                    )
                    .join(' · '),
                })}
              </CopyText>
              <CopyText>{label(`daily.moonPhase.${chart.astro.moonPhase.name}`)}</CopyText>
              {chart.date.solarTerm && (
                <CopyText>{label(`home.term.${chart.date.solarTerm.name}`)}</CopyText>
              )}
            </>
          )}
        </View>
        <Action
          id="today-calendar"
          label={t('calendar.title')}
          onPress={() => router.push('/today/calendar')}
        />
        <Action
          id="today-birth"
          label={t(active ? 'mobile.profiles.edit' : 'daily.profileCTA')}
          onPress={() =>
            router.push(active ? { pathname: '/me/birth', params: { id: active.id } } : '/me/birth')
          }
        />
        {error && (
          <ReportCard>
            <CopyText>{t('report.error.E_INTERNAL')}</CopyText>
            <Action label={t('common.retry')} onPress={refresh} />
          </ReportCard>
        )}
        {chart && value && (
          <View style={{ gap: spacing('space-5') }}>
            <BlurTargetView
              ref={sampleTarget}
              style={{ gap: spacing('space-5') }}
              pointerEvents={active ? 'auto' : 'none'}
              accessibilityElementsHidden={!active}
              importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
            >
              <ReportCard id="daily-block-2">
                <Pressable
                  testID="daily-card-longpress"
                  accessibilityRole="button"
                  accessibilityLabel={t('share.template.daily')}
                  onPress={() => setShare(true)}
                  onLongPress={() => setShare(true)}
                >
                  <CopyText>{t('daily.oneLiner.label')}</CopyText>
                  <CopyText title>{label(chart.oneLiner)}</CopyText>
                </Pressable>
              </ReportCard>
              <ReportCard id="daily-block-3">
                <CopyText title>{t('daily.ratings')}</CopyText>
                <View
                  style={{
                    borderRadius: corner('r-pill'),
                    width: spacing('space-8') * 3,
                    height: spacing('space-8') * 3,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: spacing('space-1'),
                    borderColor: `${colors.gold}${Math.round(dailyStars(chart.scores.overall) * 51)
                      .toString(16)
                      .padStart(2, '0')}`,
                    padding: spacing('space-4'),
                    alignSelf: 'center',
                  }}
                >
                  <CopyText>
                    {t('daily.stars', { count: dailyStars(chart.scores.overall) })}
                  </CopyText>
                </View>
                <CopyText>{label(`daily.rating.${dailyStars(chart.scores.overall)}`)}</CopyText>
                {domains.map((k) => (
                  <View key={k}>
                    <CopyText>
                      {t(`daily.dimension.${k}`)} ·{' '}
                      {t('daily.stars', { count: dailyStars(chart.scores[k]) })}
                    </CopyText>
                    <DailyStars count={dailyStars(chart.scores[k])} />
                    <CopyText>{label(`daily.rating.${dailyStars(chart.scores[k])}`)}</CopyText>
                  </View>
                ))}
              </ReportCard>
              <ReportCard id="daily-block-4">
                <CopyText title>{t('daily.lucky')}</CopyText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: chart.bazi.luckyColorHex,
                    }}
                  />
                  <CopyText>
                    {t('daily.lucky.color')} · {label(chart.bazi.luckyColor[0]!)}
                  </CopyText>
                </View>
                <CopyText>
                  {t('daily.lucky.number')} ·{' '}
                  {t('report.content', { text: chart.bazi.luckyNumbers.join(' / ') })}
                </CopyText>
                <CopyText>
                  {t('daily.lucky.direction')} · {label(chart.bazi.luckyDirection)}
                </CopyText>
                <CopyText>
                  {t('daily.lucky.hours')} ·{' '}
                  {t('report.content', {
                    text: chart.bazi.goodHours.map((h) => `${h.from}–${h.to}`).join(' / '),
                  })}
                </CopyText>
                <CopyText>
                  {t('daily.lucky.zodiac')} ·{' '}
                  {t('report.content', {
                    text: chart.bazi.nobleZodiac.map((z) => label(`daily.zodiac.${z}`)).join(' / '),
                  })}
                </CopyText>
                {chart.numerology && (
                  <CopyText>
                    {t('daily.personalDay', { number: chart.numerology.personalDay })}
                  </CopyText>
                )}
              </ReportCard>
              <ReportCard id="daily-block-5">
                <CopyText title>{t('daily.almanac')}</CopyText>
                {(['yi', 'ji'] as const).map((k) => (
                  <View key={k}>
                    <CopyText title>{t(`daily.${k}`)}</CopyText>
                    <CopyText>
                      {chart.bazi.almanac[k].length
                        ? chart.bazi.almanac[k].map((v) => label(v)).join(' · ')
                        : t('daily.almanacEmpty')}
                    </CopyText>
                  </View>
                ))}
              </ReportCard>
              <ReportCard id="daily-block-6">
                {['career', 'wealth', 'love', 'health'].map((k) => (
                  <View key={k}>
                    <CopyText title>{sectionTitle(k)}</CopyText>
                    <CopyText>{excerpt(k)}</CopyText>
                  </View>
                ))}
              </ReportCard>
              <View testID="daily-block-13">
                <NativeAdCard slot={0} />
              </View>
              <DailyInsights value={value} tz={tz} onShare={() => setShare(true)} />
            </BlurTargetView>
            {!active && (
              <BlurView
                blurTarget={sampleTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={60}
                tint="dark"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  paddingTop: spacing('space-8'),
                }}
              >
                <CopyText title>{t('daily.example')}</CopyText>
                <Action label={t('daily.profileCTA')} onPress={() => router.push('/me/birth')} />
              </BlurView>
            )}
          </View>
        )}
        {value && active?.data && (
          <>
            <Action
              id="today-journal"
              label={t('me.journal')}
              onPress={() => router.push('/me/journal')}
            />
            <JournalEditor
              key={`${active.id}:${date}`}
              profileId={active.id}
              profileVersion={active.data.version}
              value={value}
              tz={tz}
            />
          </>
        )}
        <CopyText>{t('report.disclaimer.short')}</CopyText>
      </ScrollView>
      {share && value && active && <DailyShare value={value} close={() => setShare(false)} />}
    </SafeAreaView>
  );
}
