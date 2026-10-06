import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { compute, hashSeed } from '@tianji/engine';
import { IchingChartSchema, IchingCategorySchema, type IchingChart } from '@tianji/shared';
import { Page, Action, CopyText, Field } from '../native-ui';
import { useCopy } from '../../lib/copy';
import { useRitualSession } from '../../lib/rituals/session';
import { useShake } from '../../lib/rituals/shake';
import {
  parseNumbers,
  ritualClock,
  throwCoins,
  type CoinCount,
  type RitualInput,
} from '../../lib/rituals/model';
import { ReportThemeContext } from '../../lib/theme';
import { QuestionFields, RitualSettings, ResultActions } from './controls';
import { CoinThrow, HexagramLines, HexagramResult, RitualBurst } from './cast-stage';
type Method = 'time' | 'numbers' | 'random' | 'liuyao';
/** Three Meihua methods and six bottom-up coin throws share one offline, reproducible report flow. */
export function IchingRitual() {
  return (
    <ReportThemeContext.Provider value="east">
      <IchingFlow />
    </ReportThemeContext.Provider>
  );
}
function IchingFlow() {
  const t = useCopy(),
    params = useLocalSearchParams<{ method?: string }>();
  const session = useRitualSession('iching');
  const [method, setMethod] = useState<Method>(
    params.method === 'liuyao' ? 'liuyao' : params.method === 'random' ? 'random' : 'time',
  );
  const [category, setCategory] = useState(() => IchingCategorySchema.parse('other'));
  const [question, setQuestion] = useState(''),
    [numbers, setNumbers] = useState(['', '', '']);
  const [stage, setStage] = useState(false),
    [invalid, setInvalid] = useState(false);
  const [now, setNow] = useState(() =>
    ritualClock(session.settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const [throws, setThrows] = useState<CoinCount[]>([]),
    [events, setEvents] = useState<number[]>([]);
  const [toss, setToss] = useState<{
    heads: CoinCount;
    key: number;
    round: number;
    duration: number;
  } | null>(null);
  const [chart, setChart] = useState<IchingChart | null>(null),
    [visible, setVisible] = useState(0);
  const [finalInput, setFinalInput] = useState<RitualInput | null>(null),
    [finalSeed, setFinalSeed] = useState(session.seed);
  function finish(next: CoinCount[], instants: number[]) {
    const seed = hashSeed(`${session.seed}|${instants.join(',')}`);
    const input: RitualInput = {
      question: {
        method: 'liuyao',
        category,
        question: question.trim() || undefined,
        liuyao: { throws: next },
      },
    };
    const result = IchingChartSchema.parse(
      compute({ system: 'iching', now, seed, ...input }).chart,
    );
    setChart(result);
    setFinalInput(input);
    setFinalSeed(seed);
    session.feedback('complete');
  }
  function castCoins(all = false) {
    if (!stage || chart || throws.length >= 6 || session.busy) return;
    const next = [...throws],
      instants = [...events];
    const steps = Array.from({ length: all ? 6 - next.length : 1 }, () => [
      {
        delay: 0,
        action: () => {
          const time = Date.now();
          const heads = throwCoins(session.seed, next.length, time);
          instants.push(time);
          next.push(heads);
          setToss({ heads, key: time, round: next.length, duration: all ? 400 : 1200 });
        },
      },
      { delay: all ? 220 : 650, action: () => session.feedback('coin') },
      {
        delay: all ? 180 : 550,
        action: () => {
          setThrows([...next]);
          setEvents([...instants]);
          if (next.length === 6) finish(next, instants);
        },
      },
    ]).flat();
    void session.sequence(steps);
  }
  useShake(stage && method === 'liuyao' && !chart && throws.length < 6, () => castCoins());
  function castMeihua() {
    if (session.busy || chart) return;
    const parsed = method === 'numbers' ? parseNumbers(numbers) : undefined;
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    const input: RitualInput = {
      question: {
        method: 'meihua',
        category,
        question: question.trim() || undefined,
        meihua: { castBy: method, at: now, ...(parsed ? { numbers: parsed } : {}) },
      },
    };
    const result = IchingChartSchema.parse(
      compute({ system: 'iching', now, seed: session.seed, ...input }).chart,
    );
    setFinalInput(input);
    setFinalSeed(session.seed);
    setChart(result);
    void session.sequence(
      Array.from({ length: 6 }, (_, i) => ({
        delay: 160,
        action: () => {
          setVisible(i + 1);
          session.feedback('palace');
        },
      })).concat([{ delay: 0, action: () => session.feedback('complete') }]),
    );
  }
  const lunar = useMemo(
    () =>
      IchingChartSchema.parse(compute({ system: 'iching', now, seed: session.seed }).chart).castAt
        .lunar,
    [now, session.seed],
  );
  const lines = throws.map((n) => (n === 1 || n === 3 ? 1 : 0));
  const moving = throws.flatMap((n, i) => (n === 0 || n === 3 ? [i + 1] : []));
  // DESIGN-GAP: Interrupted Meihua reveals resume explicitly without recomputing the reading.
  return (
    <Page title="nav.iching">
      {!stage ? (
        <>
          <CopyText>{t('divination.chooseMethod')}</CopyText>
          {(['time', 'numbers', 'random', 'liuyao'] as const).map((value) => (
            <Action
              id={`iching-method-${value}`}
              key={value}
              selected={method === value}
              label={t(`divination.methods.${value}`)}
              onPress={() => setMethod(value)}
            />
          ))}
          <QuestionFields
            question={question}
            setQuestion={setQuestion}
            category={category}
            setCategory={(value) => setCategory(IchingCategorySchema.parse(value))}
            categories={IchingCategorySchema.options}
          />
          {method === 'numbers' ? (
            <>
              <CopyText>{t('divination.numbersHelp')}</CopyText>
              {numbers.map((value, i) => (
                <Field
                  key={i}
                  id={`iching-number-${i}`}
                  label={t('divination.number', { number: i + 1 })}
                  value={value}
                  numeric
                  maxLength={3}
                  onChange={(value) => {
                    setInvalid(false);
                    setNumbers((v) => v.map((n, j) => (j === i ? value : n)));
                  }}
                />
              ))}
            </>
          ) : null}
          {invalid ? (
            <CopyText testID="ritual-invalid">{t('divination.invalidNumbers')}</CopyText>
          ) : null}
          <RitualSettings session={session} />
          <Action
            id="iching-begin"
            label={t('divination.continue')}
            onPress={() => {
              if (method === 'numbers' && !parseNumbers(numbers)) {
                setInvalid(true);
                return;
              }
              setNow(
                ritualClock(
                  session.settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                ),
              );
              session.markDirty();
              setStage(true);
            }}
          />
        </>
      ) : (
        <>
          <CopyText title>{t(`divination.methods.${method}`)}</CopyText>
          <CopyText>{t(`divination.methodHelp.${method}`)}</CopyText>
          {method === 'time' ? (
            <CopyText>
              {t('divination.lunarClock', {
                year: lunar.year,
                month: lunar.month,
                day: lunar.day,
                leap: lunar.isLeap ? t('divination.leap') : '',
                hour: Number(now.slice(11, 13)),
              })}
            </CopyText>
          ) : null}
          {method === 'liuyao' ? (
            <>
              <CopyText>{t('mobile.ritual.shakeHelp')}</CopyText>
              {toss ? (
                <ViewStage
                  heads={toss.heads}
                  round={toss.round}
                  duration={toss.duration}
                  animate={session.animate}
                />
              ) : null}
              <CopyText testID="iching-progress">
                {t('divination.throwProgress', { count: throws.length })}
              </CopyText>
              {!chart ? (
                <HexagramLines lines={lines} moving={moving} animate={session.animate} />
              ) : null}
              <Action
                id="iching-shake"
                label={t('mobile.ritual.shake')}
                disabled={session.busy || throws.length === 6}
                onPress={() => castCoins()}
              />
              <Action
                id="iching-shake-all"
                label={t('divination.shakeAll')}
                disabled={session.busy || throws.length === 6}
                onPress={() => castCoins(true)}
              />
            </>
          ) : (
            <>
              {!chart ? (
                <Action
                  id="iching-cast"
                  label={t(
                    method === 'time'
                      ? 'divination.castTime'
                      : method === 'numbers'
                        ? 'divination.castNumbers'
                        : 'divination.toss',
                  )}
                  onPress={castMeihua}
                  disabled={session.busy}
                />
              ) : null}
              {chart && visible < 6 ? (
                <HexagramLines
                  lines={chart.primary.lines.slice(0, visible)}
                  moving={chart.movingLines}
                  animate={session.animate}
                />
              ) : null}
            </>
          )}
          {chart && (method === 'liuyao' || visible === 6) ? (
            <>
              <HexagramResult chart={chart} animate={session.animate} />
              <ResultActions
                session={session}
                ready={Boolean(finalInput)}
                onSave={() => void session.save(now, finalInput!, finalSeed)}
              />
            </>
          ) : null}
          {chart && method !== 'liuyao' && visible < 6 && !session.busy ? (
            <Action id="iching-resume" label={t('tarot.next')} onPress={() => setVisible(6)} />
          ) : null}
        </>
      )}
      <Action id="ritual-exit" label={t('divination.exit')} onPress={session.exit} />
    </Page>
  );
}
function ViewStage({
  heads,
  round,
  animate,
  duration,
}: {
  heads: CoinCount;
  round: number;
  animate: boolean;
  duration: number;
}) {
  const t = useCopy();
  return (
    <View style={{ position: 'relative' }}>
      <CopyText>{t('divination.coinsLabel', { round, count: heads })}</CopyText>
      <CoinThrow heads={heads} animate={animate} duration={duration} trigger={round} />
      <RitualBurst animate={animate} preset="ink" trigger={round} />
    </View>
  );
}
