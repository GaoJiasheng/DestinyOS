import { spacing } from '@tianji/ui-core/tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useCopy } from '../../lib/copy';
import { getLocalStore } from '../../lib/data/store';
import { profileJournal, todayIn, type NativeDaily } from '../../lib/daily/service';
import { JournalInputSchema } from '@tianji/shared';
import { ReportCard } from '../report/report-ui';
import { Action, CopyText, Field } from '../native-ui';
/** Offline mood editor preserves the initial prediction while allowing sentence/mood revisions. */
export function JournalEditor({
  profileId,
  profileVersion,
  value,
  tz,
}: {
  profileId: string;
  profileVersion: number;
  value: NativeDaily;
  tz: string;
}) {
  const t = useCopy();
  const [mood, setMood] = useState<number | null>(null),
    [text, setText] = useState('');
  const [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState<'load' | 'save' | 'validation' | null>(null),
    [retry, setRetry] = useState(0);
  const date = value.chart.date.local,
    future = date > todayIn(tz);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setSaved(false);
    setError(null);
    setMood(null);
    setText('');
    void profileJournal(profileId)
      .then((entries) => {
        if (!alive) return;
        const entry = entries.find((e) => e.data?.date === date)?.data;
        setMood(entry?.mood ?? null);
        setText(entry?.text ?? '');
      })
      .catch(() => {
        if (alive) setError('load');
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [profileId, date, retry]);
  async function save() {
    const input = JournalInputSchema.safeParse({ profileId, date, tz, mood, text });
    if (!input.success) {
      setError('validation');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await (
        await getLocalStore()
      ).saveJournal({
        ...input.data,
        prediction: {
          scores: value.chart.scores,
          tz,
          profileVersion,
          engineVersion: value.engineVersion,
        },
      });
      setSaved(true);
    } catch {
      setError('save');
    } finally {
      setSaving(false);
    }
  }
  return (
    <ReportCard id="journal-editor">
      <CopyText title>{t('journal.prompt')}</CopyText>
      <CopyText>{t('mobile.journal.privacy')}</CopyText>
      {future && <CopyText>{t('journal.future')}</CopyText>}
      {busy && <CopyText>{t('common.loading')}</CopyText>}
      {error && (
        <CopyText testID="journal-error">
          {t(
            error === 'validation'
              ? 'journal.validation'
              : error === 'load'
                ? 'journal.loadError'
                : 'journal.saveError',
          )}
        </CopyText>
      )}
      {error === 'load' && (
        <Action label={t('common.retry')} onPress={() => setRetry((n) => n + 1)} />
      )}
      {!busy && error !== 'load' && (
        <>
          <CopyText>{t('journal.mood')}</CopyText>
          <View style={{ gap: spacing('space-2') }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Action
                key={n}
                id={`journal-mood-${n}`}
                selected={mood === n}
                disabled={future || saving}
                label={t(`journal.mood.${n}` as 'journal.mood.1')}
                onPress={() => {
                  setMood(n);
                  setSaved(false);
                }}
              />
            ))}
          </View>
          <Field
            id="journal-text"
            label={t('journal.text')}
            value={text}
            maxLength={500}
            onChange={(next) => {
              setText(next);
              setSaved(false);
            }}
          />
          <Action
            id="journal-save"
            label={t(saving ? 'common.loading' : 'journal.save')}
            disabled={future || saving || mood === null}
            onPress={() => void save()}
          />
          {saved && <CopyText testID="journal-saved">{t('journal.saved')}</CopyText>}
        </>
      )}
    </ReportCard>
  );
}
