import { useEffect, useState, useRef } from 'react';
import { ScrollView, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { normalizeBirth } from '@tianji/engine';
import { getFeedback, saveFeedback } from '../../lib/reports/feedback';
import {
  loadNativeReading,
  type ReportSystem,
  type NativeReading,
} from '../../lib/reports/readings';
import { sectionForNode, type ChartNode, type ChartScene } from '../../lib/reports/chart-scene';
import { bundledKnowledge } from '../../lib/knowledge/bundled';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { useTheme } from '../../lib/theme';
import { CopyText, Action } from '../native-ui';
import { ReportCard, DataTree, useChartLabel } from './report-ui';
import { ReportHeadline } from './report-headline';
import { ReportSection } from './report-section';
import { ReportParagraph } from './report-paragraph';
import { NativeChartView } from '../charts/native-chart';
import { useProfiles } from '../../lib/profiles';

/** Owner-scoped offline report route with snapshot replay, chapter folding and two-way chart links. */
export function ReportScreen({
  id,
  system,
  onBack,
}: {
  id: string;
  system: ReportSystem;
  onBack?: () => void;
}) {
  const t = useCopy(),
    label = useChartLabel(),
    { colors } = useTheme(),
    router = useRouter();
  const locale = usePreferences((s) => s.locale),
    reduced = useProfiles().settings.reducedMotion;
  const [view, setView] = useState<NativeReading | null>(null),
    [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading'),
    [retry, setRetry] = useState(0);
  const [professional, setProfessional] = useState(false),
    [fullData, setFullData] = useState(false),
    [birthOpen, setBirthOpen] = useState(false),
    [chartOpen, setChartOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}),
    [highlight, setHighlight] = useState(''),
    [votes, setVotes] = useState<Record<string, boolean>>({});
  const scroll = useRef<ScrollView>(null),
    positions = useRef<Record<string, number>>({}),
    chartY = useRef(0),
    professionalJump = useRef(false);
  useEffect(() => {
    let active = true;
    setState('loading');
    void Promise.all([loadNativeReading(id, system, locale), getFeedback(id)])
      .then(([reading, feedback]) => {
        if (!active) return;
        setView(reading);
        setVotes(feedback);
        setExpanded(Object.fromEntries(reading?.report.sections.map((s) => [s.key, true]) ?? []));
        setState(reading ? 'ready' : 'missing');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [id, system, locale, retry]);
  function jump(key: string) {
    setExpanded((current) => ({ ...current, [key]: true }));
    requestAnimationFrame(() =>
      scroll.current?.scrollTo({
        y: Math.max(0, (positions.current.body ?? 0) + (positions.current[key] ?? 0) - 76),
        animated: !reduced,
      }),
    );
  }
  function evidence(path: string) {
    setHighlight(path);
    setChartOpen(true);
    requestAnimationFrame(() =>
      scroll.current?.scrollTo({ y: chartY.current, animated: !reduced }),
    );
  }
  function select(node: ChartNode, scene: ChartScene) {
    setHighlight(node.path);
    if (view) jump(sectionForNode(view.report, view.chart, scene, node));
  }
  function related(node: ChartNode, scene: ChartScene) {
    if (view) jump(sectionForNode(view.report, view.chart, scene, node));
  }
  const data = view?.record.data,
    glossary = bundledKnowledge().glossary;
  const birth = data?.inputSnapshot.birth ? normalizeBirth(data.inputSnapshot.birth).local : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors['bg-0'] }}>
      {state !== 'ready' || !view || !data ? (
        <View testID={`report-${state}`} style={{ padding: 24, gap: 20 }}>
          <CopyText title>{t(`nav.${system}`)}</CopyText>
          {state === 'loading' ? (
            <>
              <ActivityIndicator color={colors.gold} />
              <View
                style={{ height: 150, backgroundColor: colors['surface-1'], borderRadius: 16 }}
              />
              <CopyText>{t('report.loading')}</CopyText>
            </>
          ) : (
            <>
              <CopyText>
                {t(state === 'missing' ? 'report.localMissing' : 'mobile.storage.error')}
              </CopyText>
              {state === 'error' ? (
                <Action label={t('mobile.profiles.retry')} onPress={() => setRetry((v) => v + 1)} />
              ) : null}
              <Action label={t('report.another')} onPress={() => router.replace('/reading')} />
            </>
          )}
        </View>
      ) : (
        <ScrollView
          ref={scroll}
          testID="report-scroll"
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: 36 }}
        >
          <View style={{ padding: 16, gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Action
                id="report-back"
                label={t('report.another')}
                onPress={() => (onBack ? onBack() : router.replace('/reading'))}
              />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <CopyText title>{t(`nav.${system}`)}</CopyText>
              </View>
            </View>
            {data.inputSnapshot.displayName ? (
              <CopyText>{t('report.content', { text: data.inputSnapshot.displayName })}</CopyText>
            ) : null}
            {birth ? <CopyText>{t('report.birthYear', { year: birth.year })}</CopyText> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {birth ? (
                <Action
                  id="report-birth"
                  label={t('report.birthDetails')}
                  onPress={() => setBirthOpen((v) => !v)}
                />
              ) : null}
              <Action
                id="report-pro"
                label={t('report.proView')}
                selected={professional}
                onPress={() => {
                  professionalJump.current = !professional;
                  setProfessional(!professional);
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['zh', 'en'] as const).map((language) => (
                  <Action
                    key={language}
                    id={`report-locale-${language}`}
                    label={t(`nav.locale.${language}`)}
                    selected={locale === language}
                    onPress={() => usePreferences.getState().setLocale(language)}
                  />
                ))}
              </View>
            </View>
            {birthOpen && birth ? (
              <CopyText>
                {t('report.content', {
                  text: `${birth.year}-${birth.month}-${birth.day} · ${data.inputSnapshot.birth?.timeUnknown ? t('form.birth.timeUnknown') : `${String(birth.hour).padStart(2, '0')}:${String(birth.minute).padStart(2, '0')}`} · ${birth.tz}`,
                })}
              </CopyText>
            ) : null}
            {view.stale ? <CopyText testID="report-stale">{t('report.stale')}</CopyText> : null}
            {view.warnings.map((warning) => (
              <CopyText key={warning.code}>{label(warning.messageKey)}</CopyText>
            ))}
            <ReportHeadline headline={view.report.headline} />
            <View
              onLayout={(event) => {
                chartY.current = event.nativeEvent.layout.y;
              }}
            >
              <ReportCard>
                <Action
                  id="report-chart-toggle"
                  label={t('report.chart')}
                  onPress={() => setChartOpen((v) => !v)}
                />
                {chartOpen ? (
                  <NativeChartView
                    chart={view.chart}
                    highlight={highlight}
                    onSelect={select}
                    onRelated={related}
                  />
                ) : null}
              </ReportCard>
            </View>
          </View>
          <View
            style={{
              backgroundColor: colors['bg-0'],
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderColor: colors['line-1'],
            }}
          >
            <ScrollView
              horizontal
              accessibilityLabel={t('report.nav')}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {view.report.sections.map((section) => (
                <Action
                  key={section.key}
                  id={`nav-${section.key}`}
                  label={t('report.content', { text: section.title })}
                  onPress={() => jump(section.key)}
                />
              ))}
            </ScrollView>
          </View>
          <View
            onLayout={(event) => {
              positions.current.body = event.nativeEvent.layout.y;
            }}
            style={{ padding: 16, gap: 16 }}
          >
            {view.report.sections.map((section) => (
              <View
                key={section.key}
                onLayout={(event) => {
                  positions.current[section.key] = event.nativeEvent.layout.y;
                }}
              >
                <ReportSection
                  section={section}
                  open={expanded[section.key] ?? true}
                  toggle={() =>
                    setExpanded((current) => ({
                      ...current,
                      [section.key]: !(current[section.key] ?? true),
                    }))
                  }
                  glossary={glossary}
                  onEvidence={evidence}
                  vote={votes[section.key]}
                  onVote={async (helpful) => {
                    await saveFeedback(id, section.key, helpful);
                    setVotes((current) => ({ ...current, [section.key]: helpful }));
                  }}
                />
              </View>
            ))}
            {professional ? (
              <ReportCard
                id="report-professional"
                onLayout={(event) => {
                  // DESIGN-GAP: Entering professional view jumps to its newly laid-out panel,
                  // keeping the detailed view reachable without traversing every prose chapter.
                  if (professionalJump.current) {
                    professionalJump.current = false;
                    scroll.current?.scrollTo({
                      y: Math.max(
                        0,
                        (positions.current.body ?? 0) + event.nativeEvent.layout.y - 76,
                      ),
                      animated: !reduced,
                    });
                  }
                }}
              >
                <CopyText title>{t('report.school')}</CopyText>
                <DataTree value={data.schoolUsed} />
                <CopyText title>{t('report.debug')}</CopyText>
                <DataTree
                  value={{
                    engineVersion: data.engineVersion,
                    interpretVersion: data.interpretVersion,
                    knowledgeVersion: data.knowledgeVersion,
                    ...data.meta?.debug,
                  }}
                />
                <Action
                  id="report-full-data"
                  label={t('report.rawChart')}
                  onPress={() => setFullData((v) => !v)}
                />
                {fullData ? <DataTree value={view.chart.data} /> : null}
                <CopyText title>{t('report.hits')}</CopyText>
                {view.report.hits.map((hit, i) => (
                  <View key={`${hit.unitId}-${i}`}>
                    <CopyText>
                      {t('report.content', { text: `${hit.unitId} · ${hit.weight}` })}
                    </CopyText>
                    {hit.evidence.map((item, j) => (
                      <Action
                        key={j}
                        label={t('report.content', { text: item.path })}
                        onPress={() => evidence(item.path)}
                      />
                    ))}
                  </View>
                ))}
              </ReportCard>
            ) : null}
            {view.report.doDont ? (
              <ReportCard>
                <CopyText title>{t('report.actions')}</CopyText>
                <CopyText>{t('report.do')}</CopyText>
                {view.report.doDont.do.map((text, i) => (
                  <ReportParagraph key={i} text={text} glossary={glossary} />
                ))}
                <CopyText>{t('report.dont')}</CopyText>
                {view.report.doDont.dont.map((text, i) => (
                  <ReportParagraph key={i} text={text} glossary={glossary} />
                ))}
              </ReportCard>
            ) : null}
            <CopyText>{t('legal.disclaimer.full')}</CopyText>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
