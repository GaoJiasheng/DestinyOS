'use client';
import { useSubmitTransition } from './use-submit-transition';
import { useEffect, useId, useState } from 'react';
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
import { dateIssues, type BirthField } from '@/lib/birth-form-date';
import { networkError, storageError } from '@/lib/birth-form-submit';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { useRouter } from '@/i18n/navigation';
import { afterConsent } from '@/lib/consent';
import { Button } from '@/components/ui/button';
import {
  AgeConfirmDialog,
  BirthTargetChoice,
  FieldErrors,
  invalidProps,
  type BirthTarget,
} from './birth-form-parts';
import { useAgeQuestion } from './use-age-question';
const empty: BirthInput = {
  calendar: 'gregorian',
  year: 0,
  month: 0,
  day: 0,
  timeUnknown: true,
  gender: 'unspecified',
};
const dateFields = ['year', 'month', 'day'] as const;
/** Date-only reading form; a guest's device profile is reused only when the reading is for them. */
export function NumerologyForm({
  initial,
  signedIn,
}: {
  /** A saved profile also carries its relation; anything but 'self' is someone else's birth. */
  initial?: BirthInput & { relation?: string };
  signedIn: boolean;
}) {
  const t = useCopy();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const baseId = useId();
  const [birth, setBirth] = useState(initial ?? empty);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const [working, setBusy] = useState(false);
  const { pending, run } = useSubmitTransition();
  const busy = working || pending;
  const [error, setError] = useState<MessageKey | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saved, setSaved] = useState<BirthInput | null>(null);
  const [target, setTarget] = useState<BirthTarget | null>(
    initial?.relation && initial.relation !== 'self' ? 'other' : null,
  );
  const [touched, setTouched] = useState(false);
  const [blurred, setBlurred] = useState<ReadonlySet<BirthField>>(new Set());
  const [attempted, setAttempted] = useState(false);
  // "Someone else" submits straight away, so the choice is passed along rather than read from state.
  const age = useAgeQuestion({
    focusYear: () => focus('year'),
    onOther: () => {
      setTarget('other');
      afterConsent(() => run(() => submit('other')));
    },
  });
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const local = !initial && !signedIn ? (await readAnonymous())?.profile : undefined;
        const profile = initial ?? local;
        if (active && profile) {
          // DESIGN-GAP: Calendar normalization is required only for a saved profile or submission, so date-only input avoids downloading it at first render.
          const { normalizeBirth } = await import('@tianji/engine/common');
          const { year, month, day } = normalizeBirth(profile, locale).local;
          const solar = { ...profile, calendar: 'gregorian', year, month, day, isLeapMonth: false };
          if (!active) return;
          // A guest with a device profile charts someone else unless they say otherwise.
          if (local) {
            setSaved(solar as BirthInput);
            setTarget((current) => current ?? 'other');
          } else setBirth(solar as BirthInput);
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
    setTouched(true);
    setBirth((current) => ({ ...current, ...patch }));
    setRequestId(null);
    setError(null);
  };
  const chooseTarget = (next: BirthTarget) => {
    setTarget(next);
    if (!touched) setBirth(next === 'self' && saved ? saved : empty);
  };
  const ids = Object.fromEntries(dateFields.map((f) => [f, `${baseId}-${f}`])) as Record<
    BirthField,
    string
  >;
  const issues = dateIssues(birth).filter((i) => attempted || blurred.has(i.field));
  const focus = (field: BirthField) =>
    setTimeout(() => document.getElementById(ids[field] ?? '')?.focus(), 0);
  /** Returns whether the form may be submitted; under 13 is asked about unless marked as someone else. */
  const check = async () => {
    if (!NumerologyNameSchema.safeParse(name).success) {
      setError('numerology.nameError');
      return false;
    }
    const all = dateIssues(birth);
    if (all.length) {
      setAttempted(true);
      focus(all[0]!.field);
      return false;
    }
    const parsed = BirthInputSchema.safeParse(birth);
    if (!parsed.success) {
      setError('engine.errors.E_INVALID_INPUT');
      return false;
    }
    const { isUnderThirteen } = await import('@/lib/birth-form');
    if (target !== 'other' && isUnderThirteen(parsed.data, locale)) {
      age.ask();
      return false;
    }
    return true;
  };
  const submit = async (subject: BirthTarget) => {
    const parsed = BirthInputSchema.parse(birth);
    setBusy(true);
    setError(null);
    const idempotencyKey = requestId ?? crypto.randomUUID();
    setRequestId(idempotencyKey);
    const request: ReadingRequest = {
      system: 'numerology',
      birth: parsed,
      name: name.trim() || undefined,
      locale,
      subject,
      idempotencyKey,
    };
    try {
      let result: Awaited<ReturnType<typeof createReadingAction>>;
      try {
        result = await createReadingAction(request);
      } catch {
        setError(networkError as MessageKey);
        return;
      }
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
      try {
        await updateAnonymous((data) => ({
          ...data,
          ...(subject === 'self' ? { profile: request.birth } : {}),
          readings: [reading, ...data.readings].slice(0, 50),
        }));
      } catch {
        setError(storageError as MessageKey);
        return;
      }
      router.push(`/numerology/r/local/${reading.id}`);
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
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // The check stays outside the submit lock: with consent already given the callback
          // fires before an enclosing run() has released it, and the submit would be dropped.
          void check().then((ok) => {
            if (ok) afterConsent(() => run(() => submit(target ?? 'self')));
          });
        }}
      >
        <fieldset className="birth-controls" disabled={!ready || busy}>
          <legend>{t('form.birth.calendar.gregorian')}</legend>
          {!signedIn && (saved || target) ? (
            <BirthTargetChoice value={target ?? 'other'} onChange={chooseTarget} />
          ) : null}
          <div className="birth-grid">
            {dateFields.map((field) => (
              <div className="birth-field" key={field}>
                <label htmlFor={ids[field]}>{t(`form.birth.${field}`)}</label>
                <input
                  id={ids[field]}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={field === 'year' ? 4 : 2}
                  enterKeyHint="next"
                  autoComplete={target !== 'other' ? `bday-${field}` : 'off'}
                  placeholder={t(`form.birth.placeholder.${field}`)}
                  value={birth[field] || ''}
                  onBlur={() => setBlurred((s) => new Set(s).add(field))}
                  onChange={(event) =>
                    change({ [field]: Number(event.target.value.replace(/\D/g, '')) || 0 })
                  }
                  {...invalidProps(
                    ids[field]!,
                    issues.find((i) => i.field === field),
                  )}
                />
              </div>
            ))}
          </div>
          <FieldErrors issues={issues} ids={ids} />
          <label className="birth-field">
            {t('numerology.name')}
            <input
              autoComplete="off"
              enterKeyHint="go"
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
          <div className="hero-actions birth-actions">
            <Button type="submit">{t(busy ? 'numerology.loading' : 'form.birth.submit')}</Button>
          </div>
        </fieldset>
      </form>
      {!signedIn ? <p className="muted">{t('report.localNotice')}</p> : null}
      <p className="type-small muted">{t('report.disclaimer.short')}</p>
      <AgeConfirmDialog {...age.dialog} />
    </section>
  );
}
