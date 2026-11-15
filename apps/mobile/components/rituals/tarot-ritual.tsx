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
import { useProfiles } from '../../lib/profiles';
import { useRitualSession } from '../../lib/rituals/session';
import {
  automaticPicks,
  initialQuestion,
  removePick,
  ritualClock,
  ritualZone,
  type RitualInput,
} from '../../lib/rituals/model';
import { RitualSettings, QuestionFields, ResultActions } from './controls';
import { TarotBackActions } from './tarot-back';
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
  const { settings } = useProfiles();
  const params = useLocalSearchParams<{ spread?: string; question?: string }>();
  // A question carried in from the ask sheet goes straight to shuffling; "back" can still edit it.
  const [carried] = useState(() => initialQuestion(params.question));
  const [phase, setPhase] = useState<'setup' | 'shuffle' | 'cut' | 'pick' | 'reveal'>(
    carried ? 'shuffle' : 'setup',
  );
  // DESIGN-GAP: A public spread query can preselect a documented layout; invalid values fall back to One Card.
  const [spread, setSpread] = useState(() => {
    const initial = SpreadKeySchema.safeParse(params.spread);
    return initial.success ? initial.data : SpreadKeySchema.parse('single');
  });
  const [category, setCategory] = useState(() => CategorySchema.parse('general'));
  const [question, setQuestion] = useState(carried),
    [allowReversed, setReversed] = useState(true);
  const [count, setCount] = useState(0),
    [split, setSplit] = useState(false),
    [order, setOrder] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]),
    [revealed, setRevealed] = useState<number[]>([]);
  const [now, setNow] = useState(() => (carried ? ritualClock(ritualZone(settings.tz)) : ''));
  const session = useRitualSession(
    'tarot',
    phase !== 'setup' || Boolean(question.trim()) || category !== 'general',
  );
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
  const position = (i: number) =>
    label(`tarot.position.${spread}.${TAROT_SPREADS[spread][i]!.key}.name`);
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
    if (session.busy) return;
    if (picked.includes(index)) {
      setPicked(removePick(picked, index));
      return;
    }
    if (picked.length >= total) return;
    session.feedback('pick');
    setPicked([...picked, index]);
  }
  function auto() {
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
              setNow(ritualClock(ritualZone(session.settings.tz)));
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
                total={total}
                onPick={pick}
                pickedLabel={(index) =>
                  t('tarot.unpickPosition', { position: position(picked.indexOf(index)) })
                }
                animate={session.animate}
                disabled={session.busy}
              />
              <CopyText status>{t('tarot.pickCount', { count: picked.length, total })}</CopyText>
              {picked.length ? <CopyText>{t('tarot.pickUndoHelp')}</CopyText> : null}
            </>
          ) : null}
          <SpreadThumbnail spread={spread} filled={picked.length} />
          {phase === 'pick' && picked.length === total ? (
            <Action
              id="tarot-start-reveal"
              label={t('tarot.startReveal')}
              disabled={session.busy}
              onPress={() => setPhase('reveal')}
            />
          ) : phase !== 'reveal' ? (
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
                position={position(i)}
                animate={session.animate}
                onFlip={() => flip(i)}
                onRemove={phase === 'pick' ? () => pick(picked[i]!) : undefined}
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
          <TarotBackActions
            phase={phase}
            busy={session.busy}
            started={count > 0}
            picked={picked.length > 0}
            revealed={revealed.length > 0}
            onBack={(to) => {
              if (to !== 'pick') setPicked([]);
              if (to === 'shuffle' || to === 'setup') {
                setSplit(false);
                setOrder([]);
              }
              if (to === 'setup') {
                setCount(0);
                setRevealed([]);
              }
              setPhase(to);
            }}
          />
        </>
      )}
      <Action id="ritual-exit" label={t('divination.exit')} onPress={session.exit} />
    </Page>
  );
}
