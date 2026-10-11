'use client';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { JournalInputSchema } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getJournalEntryAction, saveJournalEntryAction } from '@/app/me/journal/actions';
import { localToday } from '@/lib/daily-date';
/** Owner-only mood editor with encrypted sentence storage, loading/error/saved states and revision support. */
export function JournalForm({
  profileId,
  signedIn,
  date,
  tz,
}: {
  profileId?: string;
  signedIn: boolean;
  date: string;
  tz: string;
}) {
  const { pending, run } = useSubmitTransition();
  const t = useCopy(),
    locale = useLocale();
  const [mood, setMood] = useState<number | null>(null),
    [text, setText] = useState('');
  const [loading, setLoading] = useState(Boolean(profileId)),
    [working, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null),
    [saved, setSaved] = useState(false),
    [retry, setRetry] = useState(0);
  const saving = working || pending;
  useEffect(() => {
    if (!profileId) return;
    let active = true;
    setLoading(true);
    setSaved(false);
    setError(null);
    setMood(null);
    setText('');
    void getJournalEntryAction({ profileId, date })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setMood(result.data?.mood ?? null);
          setText(result.data?.text ?? '');
        } else setError('journal.loadError');
      })
      .catch(() => {
        if (active) setError('journal.loadError');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profileId, date, retry]);
  const future = date > localToday(tz);
  return (
    <section className="report-card journal-form" data-journal-form aria-busy={loading || saving}>
      <h2>{t('journal.prompt')}</h2>
      {!signedIn ? (
        <p>
          <Link href="/auth/login" className="text-link">
            {t('journal.login')}
          </Link>
        </p>
      ) : !profileId ? (
        <p>
          <Link href="/me/birth" className="text-link">
            {t('daily.profileCTA')}
          </Link>
        </p>
      ) : (
        <>
          <p>{t('journal.privacy')}</p>
          <Link href="/me/journal" className="text-link">
            {t('me.journal')}
          </Link>
          {future ? <p>{t('journal.future')}</p> : null}
          {loading ? <p role="status">{t('common.loading')}</p> : null}
          {error ? (
            <p role="alert">
              {t(error)}{' '}
              {error === 'journal.loadError' ? (
                <Button variant="ghost" onClick={() => setRetry((n) => n + 1)}>
                  {t('common.retry')}
                </Button>
              ) : null}
            </p>
          ) : null}
          {!loading && error !== 'journal.loadError' ? (
            <form
              className="settings-fields"
              onSubmit={(event) => {
                event.preventDefault();
                const input = JournalInputSchema.safeParse({ profileId, date, tz, mood, text });
                if (!input.success) {
                  setError('journal.validation');
                  return;
                }
                run(async () => {
                  setSaving(true);
                  setError(null);
                  setSaved(false);
                  await saveJournalEntryAction(input.data, locale)
                    .then((result) => {
                      if (result.ok) {
                        setSaved(true);
                        setText(result.data.text);
                      } else
                        setError(
                          result.error.code === 'E_DATE_OUT_OF_RANGE'
                            ? 'journal.future'
                            : result.error.code === 'E_RATE_LIMITED'
                              ? 'report.error.E_RATE_LIMITED'
                              : 'journal.saveError',
                        );
                    })
                    .catch(() => setError('journal.saveError'))
                    .finally(() => setSaving(false));
                });
              }}
            >
              <fieldset disabled={saving || future} className="journal-moods">
                <legend>{t('journal.mood')}</legend>
                <div className="action-row">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="mood"
                        value={value}
                        checked={mood === value}
                        required
                        onChange={() => {
                          setMood(value);
                          setSaved(false);
                        }}
                      />
                      {t(`journal.mood.${value}` as MessageKey)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                {t('journal.text')}
                <input
                  name="journalText"
                  value={text}
                  maxLength={500}
                  disabled={saving || future}
                  onChange={(event) => {
                    setText(event.target.value);
                    setSaved(false);
                  }}
                />
              </label>
              <Button type="submit" disabled={saving || future || mood === null}>
                {t(saving ? 'common.loading' : 'journal.save')}
              </Button>
              {saved ? <p role="status">{t('journal.saved')}</p> : null}
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
