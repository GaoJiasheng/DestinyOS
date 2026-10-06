import { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { dailyExcerpt } from '@tianji/ui-core/daily-excerpt';
import type { NativeDaily } from '../../lib/daily/service';
import { todayIn, hasVedicHistory } from '../../lib/daily/service';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { useProfiles } from '../../lib/profiles';
import { getFeedback, saveFeedback } from '../../lib/reports/feedback';
import { useEffectsMotion } from '../effects/motion';
import { useRitualFeedback } from '../../lib/rituals/feedback';
import { RitualCard } from '../rituals/tarot-card';
import { ReportCard, useChartLabel } from '../report/report-ui';
import { Action, CopyText } from '../native-ui';

/** Astronomy, daily card, Panchang, action words, period placeholder and encrypted feedback. */
export function DailyInsights({
  value,
  tz,
  onShare,
}: {
  value: NativeDaily;
  tz: string;
  onShare: () => void;
}) {
  const t = useCopy(),
    label = useChartLabel(),
    router = useRouter(),
    locale = usePreferences((s) => s.locale);
  const chart = value.chart,
    date = chart.date.local;
  const [panchang, setPanchang] = useState(false),
    [flipped, setFlipped] = useState(false);
  const [vote, setVote] = useState<boolean | undefined>(),
    [voteError, setVoteError] = useState(false),
    [voting, setVoting] = useState(false);
  const { active: motion } = useEffectsMotion();
  const { settings } = useProfiles();
  const animate = motion && !settings.reducedMotion;
  const { feedback } = useRitualFeedback();
  useEffect(() => {
    let alive = true;
    // DESIGN-GAP: Native Panchang follows prior Vedic use; persisted user override belongs to the settings task.
    void hasVedicHistory()
      .then((used) => {
        if (alive) setPanchang(used);
      })
      .catch(() => undefined);
    setFlipped(false);
    setVote(undefined);
    setVoteError(false);
    if (value?.id)
      void getFeedback(value.id)
        .then((votes) => {
          if (alive) setVote(votes.daily);
        })
        .catch(() => {
          if (alive) setVoteError(true);
        });
    return () => {
      alive = false;
    };
  }, [value?.id, date]);
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
  return (
    <>
      <ReportCard id="daily-block-7">
        <CopyText title>{sectionTitle('astro')}</CopyText>
        <CopyText>
          {label(`charts.sign.${chart.astro.moonSign}`)} ·{' '}
          {label(`daily.moonPhase.${chart.astro.moonPhase.name}`)}
        </CopyText>
        <CopyText>{excerpt('astro')}</CopyText>
        {chart.astro.transits.slice(0, 2).map((v, i) => (
          <CopyText key={i}>
            {label(`charts.planet.${v.transiting}`)} · {label(`charts.aspect.${v.aspect}`)} ·{' '}
            {label(
              `${['asc', 'mc'].includes(v.natal) ? 'charts.angle' : 'charts.planet'}.${v.natal}`,
            )}
          </CopyText>
        ))}
        {chart.astro.retrogrades.map((v) => (
          <CopyText key={v}>
            {label(`charts.planet.${v}`)} · {t('charts.retrograde')}
          </CopyText>
        ))}
      </ReportCard>
      <ReportCard id="daily-block-8">
        <CopyText title>{sectionTitle('tarot')}</CopyText>
        <RitualCard
          index={0}
          position={t('daily.cardFlip')}
          revealed={flipped}
          animate={animate}
          card={{
            cardKey: chart.tarot.card,
            reversed: chart.tarot.reversed,
            position: 'single',
            order: 0,
          }}
          onFlip={() => {
            setFlipped(true);
            feedback('flip');
          }}
        />
        {flipped && (
          <>
            <CopyText>{excerpt('tarot')}</CopyText>
            <Action
              id="daily-card-learn"
              label={t('daily.cardLearn')}
              onPress={() => router.push(`/learn/tarot/${chart.tarot.card}`)}
            />
          </>
        )}
      </ReportCard>
      <ReportCard id="daily-block-9">
        <Action
          id="daily-panchang"
          selected={panchang}
          label={sectionTitle('panchang')}
          onPress={() => setPanchang(!panchang)}
        />
        {panchang && (
          <>
            {(['tithi', 'nakshatra', 'yoga', 'karana', 'vara'] as const).map((k) => (
              <CopyText key={k}>
                {t(`daily.panchang.${k}`)} ·{' '}
                {chart.vedic
                  ? label(
                      `charts.panchang.${k}.${chart.vedic[k].key}`,
                      t('daily.panchang.value', {
                        index: chart.vedic[k].index,
                        time: new Intl.DateTimeFormat(locale, {
                          timeStyle: 'short',
                          timeZone: tz,
                        }).format(new Date(chart.vedic[k].endsAt)),
                      }),
                    )
                  : ''}
              </CopyText>
            ))}
            <CopyText>{excerpt('panchang')}</CopyText>
          </>
        )}
      </ReportCard>
      <ReportCard id="daily-block-10">
        <CopyText title>{t('daily.doDont')}</CopyText>
        {(['do', 'dont'] as const).map((k) => (
          <View key={k}>
            <CopyText title>{t(`daily.${k}`)}</CopyText>
            <CopyText>
              {t('report.content', { text: (value.report.doDont?.[k] ?? []).join(' · ') })}
            </CopyText>
          </View>
        ))}
        <Action id="daily-share" label={t('share.generate')} onPress={() => onShare()} />
      </ReportCard>
      <ReportCard id="daily-block-11">
        <CopyText title>{t('daily.period')}</CopyText>
        <Action label={t('daily.week')} disabled onPress={() => undefined} />
        <Action label={t('daily.month')} disabled onPress={() => undefined} />
        <CopyText>{t('daily.periodSoon')}</CopyText>
      </ReportCard>
      <ReportCard id="daily-block-12">
        <CopyText title>{t('daily.feedback')}</CopyText>
        {([true, false] as const).map((yes) => (
          <Action
            key={String(yes)}
            id={`daily-vote-${yes ? 'yes' : 'no'}`}
            selected={vote === yes}
            disabled={voting || date > todayIn(tz)}
            label={t(yes ? 'daily.feedbackYes' : 'daily.feedbackNo')}
            onPress={() => {
              if (!value.id) return;
              setVoting(true);
              setVoteError(false);
              void saveFeedback(value.id, 'daily', yes)
                .then(() => setVote(yes))
                .catch(() => setVoteError(true))
                .finally(() => setVoting(false));
            }}
          />
        ))}
        {vote !== undefined && <CopyText>{t('daily.feedbackSaved')}</CopyText>}
        {voteError && <CopyText>{t('mobile.storage.error')}</CopyText>}
      </ReportCard>
    </>
  );
}
