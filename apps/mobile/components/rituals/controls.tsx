import { useState } from 'react';
import { View } from 'react-native';
import type { useRitualSession } from '../../lib/rituals/session';
import { useCopy } from '../../lib/copy';
import { useChartLabel } from '../report/report-ui';
import { useNativePickers } from '../native-pickers';
import { Action, CopyText, Field } from '../native-ui';
export type Session = ReturnType<typeof useRitualSession>;
/** Persist feedback switches through encrypted settings and expose failures without losing the ritual. */
export function RitualSettings({ session }: { session: Session }) {
  const t = useCopy(),
    { toggle } = useNativePickers();
  const [failed, setFailed] = useState(false);
  function update(patch: Parameters<Session['updateSettings']>[0]) {
    setFailed(false);
    void session.updateSettings(patch).catch(() => setFailed(true));
  }
  return (
    <View style={{ gap: 12 }}>
      {toggle(
        t('me.sound'),
        session.settings.soundOn,
        (soundOn) => update({ soundOn }),
        'ritual-sound',
      )}
      {toggle(
        t('mobile.ritual.haptics'),
        session.settings.hapticsOn,
        (hapticsOn) => update({ hapticsOn }),
        'ritual-haptics',
      )}
      {toggle(
        t('me.motion'),
        session.settings.reducedMotion,
        (reducedMotion) => update({ reducedMotion }),
        'ritual-motion',
      )}
      {failed ? <CopyText>{t('mobile.storage.error')}</CopyText> : null}
    </View>
  );
}
/** Shared optional private question and documented category choices, localized through next-intl. */
export function QuestionFields({
  question,
  setQuestion,
  category,
  setCategory,
  categories,
  tarot = false,
}: {
  question: string;
  setQuestion: (text: string) => void;
  category: string;
  setCategory: (category: string) => void;
  categories: readonly string[];
  tarot?: boolean;
}) {
  const t = useCopy(),
    label = useChartLabel(),
    { wheel } = useNativePickers();
  return (
    <>
      <Field
        id="ritual-question"
        label={t(tarot ? 'tarot.question' : 'divination.question')}
        value={question}
        onChange={setQuestion}
        maxLength={120}
        placeholder={t('divination.questionPlaceholder')}
      />
      {wheel(
        t('divination.category'),
        category,
        (value) => setCategory(String(value)),
        categories.map((value) => ({
          value,
          label: label(
            `${tarot ? 'tarot' : 'divination'}.${tarot ? 'category' : 'categories'}.${value}`,
          ),
        })),
        'ritual-category',
      )}
    </>
  );
}
/** Show a recoverable save error and keep the final chart intact for retries. */
export function ResultActions({
  session,
  ready,
  onSave,
}: {
  session: Session;
  ready: boolean;
  onSave: () => void;
}) {
  const t = useCopy();
  return (
    <>
      {session.error ? <CopyText testID="ritual-error">{t('tarot.error')}</CopyText> : null}
      <Action
        id="ritual-result"
        disabled={!ready || session.busy}
        label={
          session.busy ? t('tarot.saving') : t(session.error ? 'divination.retry' : 'tarot.result')
        }
        onPress={onSave}
      />
    </>
  );
}
