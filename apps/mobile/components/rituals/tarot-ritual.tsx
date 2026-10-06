import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { compute, hashSeed } from '@tianji/engine';
import { TAROT_SPREADS, SpreadKeySchema, CategorySchema, TarotChartSchema } from '@tianji/shared';
import { Page, Action, CopyText } from '../native-ui';
import { useNativePickers } from '../native-pickers';
import { useCopy } from '../../lib/copy';
import { useChartLabel } from '../report/report-ui';
import { ReportThemeContext } from '../../lib/theme';
import { useRitualSession } from '../../lib/rituals/session';
import { automaticPicks, ritualClock, type RitualInput } from '../../lib/rituals/model';
import { RitualSettings, QuestionFields, ResultActions } from './controls';
import { DeckStage, SpreadThumbnail, TarotFan, RitualCard } from './tarot-stage';
/** Native seeded tarot ritual; card selection, cut order and shuffle history survive in its encrypted snapshot. */
export function TarotRitual() {
  return (
    <ReportThemeContext.Provider value="west">
      <TarotFlow />
    </ReportThemeContext.Provider>
  );
}
function TarotFlow() {
  const t = useCopy(),
    label = useChartLabel(),
    { wheel, toggle } = useNativePickers();
  const session = useRitualSession('tarot');
  const params = useLocalSearchParams<{ spread?: string }>();
  const [phase, setPhase] = useState<'setup' | 'shuffle' | 'cut' | 'pick' | 'reveal'>('setup');
  // DESIGN-GAP: A public spread query can preselect a documented layout; invalid values fall back to One Card.
  const [spread, setSpread] = useState(() => {
    const initial = SpreadKeySchema.safeParse(params.spread);
    return initial.success ? initial.data : SpreadKeySchema.parse('single');
  });
  const [category, setCategory] = useState(() => CategorySchema.parse('general'));
  const [question, setQuestion] = useState(''),
    [allowReversed, setReversed] = useState(true);
  const [count, setCount] = useState(0),
    [split, setSplit] = useState(false),
    [order, setOrder] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]),
    [revealed, setRevealed] = useState<number[]>([]);
  const [now, setNow] = useState('');
  const total = TAROT_SPREADS[spread].length;
  const seed = hashSeed(`${session.seed}|shuffle:${count}|cut:${order.join(',')}`);
  const input: RitualInput = {
    spread,
    category,
    allowReversed,
    pickedIndices: picked,
    question: question.trim() ? { text: question.trim() } : undefined,
  };
  const chart = useMemo(
    () =>
      picked.length === total && now
        ? TarotChartSchema.parse(
            compute({
              system: 'tarot',
              now,
              seed,
              spread,
              category,
              allowReversed,
              pickedIndices: picked,
              question: question.trim() ? { text: question.trim() } : undefined,
            }).chart,
          )
        : null,
    [picked, total, now, seed, spread, category, allowReversed, question],
  );
  function shuffle() {
    if (session.busy) return;
    void session.sequence([
      {
        delay: 0,
        action: () => {
          setCount((v) => v + 1);
          session.feedback('shuffle');
        },
      },
      { delay: 540, action: () => undefined },
    ]);
  }
  function pick(index: number) {
    if (session.busy || picked.includes(index) || picked.length >= total) return;
    session.markDirty();
    session.feedback('pick');
    const next = [...picked, index];
    setPicked(next);
    if (next.length === total) setPhase('reveal');
  }
  function auto() {
    session.markDirty();
    session.feedback('shuffle');
    if (count === 0) setCount(1);
    setPicked(automaticPicks(seed, spread, picked));
    setPhase('reveal');
  }
  function flip(index: number) {
    if (session.busy || revealed.includes(index)) return;
    void session.sequence([
      {
        delay: 0,
        action: () => {
          setRevealed((v) => [...v, index]);
          session.feedback('flip');
        },
      },
      {
        delay: 900,
        action: () => {
          if (revealed.length + 1 === total) session.feedback('complete');
        },
      },
    ]);
  }
  function flipAll() {
    void session.sequence(
      chart!.cards
        .filter((_, i) => !revealed.includes(i))
        .flatMap((card) => [
          {
            delay: 0,
            action: () => {
              setRevealed((v) => [...v, card.order]);
              session.feedback('flip');
            },
          },
          { delay: 900, action: () => undefined },
        ])
        .concat([{ delay: 0, action: () => session.feedback('complete') }]),
    );
  }
  return (
    <Page title="nav.tarot">
      {phase === 'setup' ? (
        <>
          {wheel(
            t('tarot.layout'),
            spread,
            (value) => setSpread(SpreadKeySchema.parse(value)),
            SpreadKeySchema.options.map((value) => ({
              value,
              label: label(`tarot.spread.${value}.name`),
            })),
            'tarot-spread',
          )}
          <SpreadThumbnail spread={spread} />
          <CopyText>{label(`tarot.spread.${spread}.hint`)}</CopyText>
          <QuestionFields
            tarot
            question={question}
            setQuestion={setQuestion}
            category={category}
            setCategory={(value) => setCategory(CategorySchema.parse(value))}
            categories={CategorySchema.options}
          />
          {toggle(t('tarot.allowReversed'), allowReversed, setReversed, 'tarot-reversed')}
          <RitualSettings session={session} />
          <Action
            id="tarot-begin"
            label={t('tarot.begin')}
            onPress={() => {
              setNow(
                ritualClock(
                  session.settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                ),
              );
              session.markDirty();
              setPhase('shuffle');
            }}
          />
        </>
      ) : (
        <>
          <CopyText title>{t(`tarot.${phase}`)}</CopyText>
          {phase === 'shuffle' ? (
            <>
              <CopyText>{t('tarot.shuffleHelp')}</CopyText>
              <DeckStage
                count={count}
                animate={session.animate}
                disabled={session.busy}
                cut={false}
                split={false}
                shuffle={shuffle}
                onSplit={() => undefined}
                order={[]}
                onPile={() => undefined}
              />
              <CopyText>{t('tarot.shuffleCount', { count })}</CopyText>
              <Action
                id="tarot-shuffle"
                label={t('tarot.shuffle')}
                disabled={session.busy}
                onPress={shuffle}
              />
              <Action
                id="tarot-next"
                label={t('tarot.next')}
                disabled={!count || session.busy}
                onPress={() => setPhase('cut')}
              />
            </>
          ) : null}
          {phase === 'cut' ? (
            <>
              <CopyText>{t('tarot.cutHelp')}</CopyText>
              <DeckStage
                count={count}
                animate={session.animate}
                disabled={session.busy}
                cut
                split={split}
                shuffle={shuffle}
                onSplit={() => {
                  setSplit(true);
                  session.feedback('shuffle');
                }}
                order={order}
                onPile={(i) => {
                  if (!order.includes(i)) {
                    setOrder((v) => [...v, i]);
                    session.feedback('pick');
                  }
                }}
              />
              {!split ? (
                <Action
                  id="tarot-split"
                  label={t('tarot.split')}
                  onPress={() => {
                    setSplit(true);
                    session.feedback('shuffle');
                  }}
                />
              ) : (
                <CopyText>
                  {t('tarot.cutOrder', { order: order.map((i) => i + 1).join(' → ') })}
                </CopyText>
              )}
              <Action
                id="tarot-cut-next"
                label={t('tarot.next')}
                disabled={order.length !== 3}
                onPress={() => setPhase('pick')}
              />
              <Action
                id="tarot-skip"
                label={t('tarot.skip')}
                onPress={() => {
                  setOrder([]);
                  setPhase('pick');
                }}
              />
            </>
          ) : null}
          {phase === 'pick' ? (
            <>
              <CopyText>{t('tarot.pickHelp')}</CopyText>
              <TarotFan
                picked={picked}
                onPick={pick}
                animate={session.animate}
                disabled={session.busy}
              />
              <CopyText>{t('tarot.pickCount', { count: picked.length, total })}</CopyText>
            </>
          ) : null}
          <SpreadThumbnail spread={spread} filled={picked.length} />
          {phase !== 'reveal' ? (
            <Action
              id="tarot-auto"
              label={t('tarot.auto')}
              disabled={session.busy}
              onPress={auto}
            />
          ) : (
            <>
              <CopyText>{t('tarot.revealHelp')}</CopyText>
              <Action
                id="tarot-reveal-all"
                label={t('tarot.revealAll')}
                disabled={session.busy || revealed.length === total}
                onPress={flipAll}
              />
            </>
          )}
          <View style={{ gap: 24 }}>
            {picked.map((_, i) => (
              <RitualCard
                key={i}
                index={i}
                card={chart?.cards[i]}
                revealed={revealed.includes(i)}
                position={label(`tarot.position.${spread}.${TAROT_SPREADS[spread][i]!.key}.name`)}
                animate={session.animate}
                onFlip={() => flip(i)}
                sideways={TAROT_SPREADS[spread][i]!.rotation === 90}
              />
            ))}
          </View>
          {phase === 'reveal' ? (
            <ResultActions
              session={session}
              ready={revealed.length === total}
              onSave={() => void session.save(now, input, seed)}
            />
          ) : null}
        </>
      )}
      <Action id="ritual-exit" label={t('divination.exit')} onPress={session.exit} />
    </Page>
  );
}
