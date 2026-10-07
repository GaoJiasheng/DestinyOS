'use client';
import { useSubmitTransition } from './use-submit-transition';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  BirthInputSchema,
  NumerologyNameSchema,
  type BirthInput,
  type Locale,
} from '@tianji/shared';
import { createReadingAction } from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading, ReadingRequest } from '@/lib/reading-schema';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
const empty: BirthInput = {
  calendar: 'gregorian',
  year: 0,
  month: 1,
  day: 1,
  timeUnknown: true,
  gender: 'unspecified',
};
/** Date-only reading form; reuses the encrypted profile and accepts an optional English name. */
export function NumerologyForm({ initial, signedIn }: { initial?: BirthInput; signedIn: boolean }) {
  const t = useCopy();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [birth, setBirth] = useState(initial ?? empty);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const [working, setBusy] = useState(false);
  const { pending, run } = useSubmitTransition();
  const busy = working || pending;
  const [error, setError] = useState<MessageKey | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const profile = initial ?? (!signedIn ? (await readAnonymous())?.profile : undefined);
        if (active && profile) {
          // DESIGN-GAP: Calendar normalization is required only for a saved profile or submission, so date-only input avoids downloading it at first render.
          const { normalizeBirth } = await import('@tianji/engine/common');
          const { year, month, day } = normalizeBirth(profile, locale).local;
          setBirth({ ...profile, calendar: 'gregorian', year, month, day, isLeapMonth: false });
        }
      } catch {
        if (active) setError('report.storageError');
      } finally {
        if (active) setReady(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [initial, signedIn, locale]);
  const change = (patch: Partial<BirthInput>) => {
    setBirth((current) => ({ ...current, ...patch }));
    setRequestId(null);
    setError(null);
  };
  const submit = async () => {
    if (!NumerologyNameSchema.safeParse(name).success) {
      setError('numerology.nameError');
      return;
    }
    const parsed = BirthInputSchema.safeParse(birth);
    try {
      if (!parsed.success) {
        setError('engine.errors.E_INVALID_INPUT');
        return;
      }
      const { normalizeBirth } = await import('@tianji/engine/common');
      normalizeBirth(parsed.data, locale);
    } catch {
      setError('engine.errors.E_INVALID_INPUT');
      return;
    }
    setBusy(true);
    setError(null);
    const idempotencyKey = requestId ?? crypto.randomUUID();
    setRequestId(idempotencyKey);
    const request: ReadingRequest = {
      system: 'numerology',
      birth: parsed.data,
      name: name.trim() || undefined,
      locale,
      idempotencyKey,
    };
    try {
      const result = await createReadingAction(request);
      if (!result.ok) {
        if (result.error.code === 'E_AGE_RESTRICTED') router.replace('/age-restricted');
        else setError(`report.error.${result.error.code}` as MessageKey);
        return;
      }
      if ('readingId' in result.data && result.data.readingId) {
        router.push(`/numerology/r/${result.data.readingId}`);
        return;
      }
      const reading: LocalReading = {
        id: crypto.randomUUID(),
        system: 'numerology',
        createdAt: new Date().toISOString(),
        title: null,
        request,
        ...result.data,
      };
      await updateAnonymous((data) => ({
        ...data,
        profile: request.birth,
        readings: [reading, ...data.readings].slice(0, 50),
      }));
      router.push(`/numerology/r/local/${reading.id}`);
    } catch {
      setError('report.storageError');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="birth-shell">
      <p className="eyebrow">{t('numerology.school')}</p>
      <h1 className="type-h1">{t('nav.numerology')}</h1>
      <p className="muted">{t('numerology.inputHelp')}</p>
      <form
        className="birth-card"
        onSubmit={(event) => {
          event.preventDefault();
          run(submit);
        }}
      >
        <fieldset className="birth-controls" disabled={!ready || busy}>
          <legend>{t('form.birth.calendar.gregorian')}</legend>
          <div className="birth-grid">
            {(['year', 'month', 'day'] as const).map((field) => (
              <label className="birth-field" key={field}>
                {t(`form.birth.${field}`)}
                <input
                  type="number"
                  required
                  min={field === 'year' ? 1900 : 1}
                  max={field === 'year' ? 2100 : field === 'month' ? 12 : 31}
                  value={birth[field] || ''}
                  onChange={(event) => change({ [field]: Number(event.target.value) })}
                />
              </label>
            ))}
          </div>
          <label className="birth-field">
            {t('numerology.name')}
            <input
              autoComplete="off"
              maxLength={120}
              value={name}
              aria-describedby="numerology-name-help"
              onChange={(event) => {
                setName(event.target.value);
                setRequestId(null);
                setError(null);
              }}
            />
          </label>
          <p id="numerology-name-help" className="muted">
            {t('numerology.nameHelp')}
          </p>
          {error ? (
            <p role="alert" className="form-error">
              {t(error)}
            </p>
          ) : null}
          <Button type="submit">{t(busy ? 'numerology.loading' : 'form.birth.submit')}</Button>
        </fieldset>
      </form>
      {!signedIn ? <p className="muted">{t('report.localNotice')}</p> : null}
      <p className="type-small muted">{t('report.disclaimer.short')}</p>
    </section>
  );
}
