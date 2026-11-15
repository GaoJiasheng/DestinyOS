import { corner, nativeTypography, spacing } from '@tianji/ui-core/tokens';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { getLocalStore } from '../../lib/data/store';
import { profileJournal, todayIn, type NativeDaily } from '../../lib/daily/service';
import {
  clearJournalDraft,
  readJournalDraft,
  writeJournalDraft,
} from '../../lib/daily/journal-drafts';
import { JournalInputSchema } from '@tianji/shared';
import { ReportCard } from '../report/report-ui';
import { Action, CopyText } from '../native-ui';
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
  const t = useCopy(),
    { colors, body } = useTheme();
  const [mood, setMood] = useState<number | null>(null),
    [text, setText] = useState(''),
    [restored, setRestored] = useState(false);
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
    setRestored(false);
    void profileJournal(profileId)
      .then((entries) => {
        if (!alive) return;
        const entry = entries.find((e) => e.data?.date === date)?.data;
        // An unsaved edit from earlier in this session wins over the stored entry.
        const draft = readJournalDraft(profileId, date);
        setMood(draft ? draft.mood : (entry?.mood ?? null));
        setText(draft ? draft.text : (entry?.text ?? ''));
        setRestored(Boolean(draft));
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
  function edit(next: { mood?: number | null; text?: string }) {
    const draft = { mood: next.mood !== undefined ? next.mood : mood, text: next.text ?? text };
    setMood(draft.mood);
    setText(draft.text);
    setSaved(false);
    writeJournalDraft(profileId, date, draft);
  }
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
      clearJournalDraft(profileId, date);
      setRestored(false);
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
                onPress={() => edit({ mood: n })}
              />
            ))}
          </View>
          <CopyText>{t('journal.text')}</CopyText>
          {/* DESIGN-GAP: Native Field is single-line; the sentence wraps here but line breaks stay disallowed by the shared schema. */}
          <TextInput
            testID="journal-text"
            accessibilityLabel={t('journal.text')}
            value={text}
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            maxLength={500}
            textAlignVertical="top"
            onChangeText={(next) => edit({ text: next.replace(/[\r\n]+/g, ' ') })}
            style={{
              minHeight: 120,
              borderWidth: 1,
              borderColor: colors['line-2'],
              borderRadius: corner('r-md'),
              padding: 12,
              color: colors['text-1'],
              fontFamily: body,
              fontSize: nativeTypography.body,
            }}
          />
          {restored && <CopyText testID="journal-draft">{t('mobile.journal.draftKept')}</CopyText>}
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
