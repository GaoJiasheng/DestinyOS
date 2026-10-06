import { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Temporal } from '@js-temporal/polyfill';
import { compute, normalizeBirth } from '@tianji/engine';
import { QimenChartSchema, QimenCategorySchema, type QimenChart } from '@tianji/shared';
import { useProfiles } from '../../lib/profiles';
import { useCopy } from '../../lib/copy';
import { useRitualSession } from '../../lib/rituals/session';
import { ritualClock, type RitualInput } from '../../lib/rituals/model';
import { ReportThemeContext } from '../../lib/theme';
import { Page, Action, CopyText, Field } from '../native-ui';
import { QuestionFields, RitualSettings, ResultActions } from './controls';
import { QimenLighting } from './cast-stage';
/** Explicit civil time and category feed the shared rotating/chaibu Qimen engine, followed by four GPU layers. */
export function QimenRitual() {
  return (
    <ReportThemeContext.Provider value="east">
      <QimenFlow />
    </ReportThemeContext.Provider>
  );
}
function QimenFlow() {
  const t = useCopy(),
    session = useRitualSession('qimen'),
    { active } = useProfiles();
  const [tz, setTz] = useState(
    session.settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [local, setLocal] = useState(() =>
    Temporal.ZonedDateTime.from(ritualClock(tz)).toPlainDateTime().toString(),
  );
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [category, setCategory] = useState(() => QimenCategorySchema.parse('general'));
  const [question, setQuestion] = useState(''),
    [invalid, setInvalid] = useState(false);
  const [chart, setChart] = useState<QimenChart | null>(null),
    [beat, setBeat] = useState(0);
  const [input, setInput] = useState<RitualInput | null>(null),
    [now, setNow] = useState('');
  function cast() {
    try {
      const clock = Temporal.PlainDateTime.from(local)
        .toZonedDateTime(tz, { disambiguation: 'reject' })
        .toString();
      const input: RitualInput = {
        question: { at: clock, category, question: question.trim() || undefined },
      };
      const result = QimenChartSchema.parse(
        compute({ system: 'qimen', now: clock, seed: session.seed, ...input }).chart,
      );
      setInvalid(false);
      setChart(result);
      setInput(input);
      setNow(clock);
      // DESIGN-GAP: Spread each 300ms layer over nine 33ms palace beats; four layers retain the documented 1.2s total.
      void session.sequence(
        Array.from({ length: 36 }, (_, i) => ({
          delay: 33,
          action: () => {
            setBeat(i + 1);
            if (i % 9 === 0) session.feedback('palace');
          },
        })).concat([{ delay: 0, action: () => session.feedback('complete') }]),
      );
    } catch {
      setInvalid(true);
    }
  }
  let date: Date | null = null;
  try {
    date = new Date(
      Number(Temporal.PlainDateTime.from(local).toZonedDateTime(tz).epochMilliseconds),
    );
  } catch {
    /* invalid input stays editable */
  }
  return (
    <Page title="nav.qimen">
      {!chart ? (
        <>
          <CopyText>{t('divination.school')}</CopyText>
          <Field id="qimen-timezone" label={t('divination.timezone')} value={tz} onChange={setTz} />
          <Field
            id="qimen-clock"
            label={t('divination.castAt')}
            value={local}
            onChange={setLocal}
          />
          <Action
            id="qimen-now"
            label={t('divination.now')}
            onPress={() => {
              try {
                setLocal(Temporal.ZonedDateTime.from(ritualClock(tz)).toPlainDateTime().toString());
                setInvalid(false);
              } catch {
                setInvalid(true);
              }
            }}
          />
          <Action
            id="qimen-date"
            label={t('form.birth.dateTime')}
            onPress={() => setPicker('date')}
          />
          <Action id="qimen-time" label={t('form.birth.time')} onPress={() => setPicker('time')} />
          {picker && date ? (
            <DateTimePicker
              testID="qimen-native-clock"
              mode={picker}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              value={date}
              timeZoneName={tz}
              themeVariant="dark"
              onChange={(_, value) => {
                if (Platform.OS === 'android') setPicker(null);
                if (value)
                  setLocal(
                    Temporal.Instant.fromEpochMilliseconds(value.getTime())
                      .toZonedDateTimeISO(tz)
                      .toPlainDateTime()
                      .toString(),
                  );
              }}
            />
          ) : null}
          {active?.data && !active.data.birth.timeUnknown ? (
            <Action
              id="qimen-birth"
              label={t('mobile.ritual.birthClock')}
              onPress={() => {
                const birth = normalizeBirth(active.data!.birth);
                if (!birth.utc) return;
                const clock = Temporal.Instant.from(birth.utc).toZonedDateTimeISO(birth.local.tz);
                setTz(clock.timeZoneId);
                setLocal(clock.toPlainDateTime().toString());
              }}
            />
          ) : null}
          <QuestionFields
            question={question}
            setQuestion={setQuestion}
            category={category}
            setCategory={(value) => setCategory(QimenCategorySchema.parse(value))}
            categories={QimenCategorySchema.options}
          />
          <RitualSettings session={session} />
          {invalid ? (
            <CopyText testID="ritual-invalid">{t('divination.invalidClock')}</CopyText>
          ) : null}
          <Action
            id="qimen-cast"
            label={t('divination.castQimen')}
            onPress={cast}
            disabled={session.busy}
          />
        </>
      ) : (
        <>
          <CopyText title>{t('divination.castQimen')}</CopyText>
          <QimenLighting chart={chart} beat={beat} animate={session.animate} />
          {beat < 36 && !session.busy ? (
            <Action id="qimen-resume" label={t('tarot.next')} onPress={() => setBeat(36)} />
          ) : null}
          <ResultActions
            session={session}
            ready={beat === 36}
            onSave={() => void session.save(now, input!)}
          />
        </>
      )}
      <Action id="ritual-exit" label={t('divination.exit')} onPress={session.exit} />
    </Page>
  );
}
