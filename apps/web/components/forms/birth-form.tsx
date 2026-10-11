'use client';
import { useSubmitTransition } from './use-submit-transition';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { normalizeBirth } from '@tianji/engine/common';
import { BirthInputSchema, type BirthInput, type Locale, type System } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { useRouter } from '@/i18n/navigation';
import { initialBirth } from '@/lib/birth-form-initial';
import { birthError, isUnderThirteen, lunarMonths } from '@/lib/birth-form';
import { createReadingAction, upsertProfileAction, blockAgeAction } from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { ReadingRequest, LocalReading } from '@/lib/reading-schema';
import { Button } from '@/components/ui/button';
import { BirthSchoolFields } from './birth-school-fields';
import { BirthDateFields } from './birth-date-fields';
import { BirthPlaceFields } from './birth-place-fields';
import { DivinationLoader } from '@/components/ui/divination-loader';
/** Two-step shared birth editor with live calendar/timezone validation and privacy-safe submission. */
export function BirthForm({
  system = 'bazi',
  initial,
  profileMode = false,
  signedIn = false,
  onComplete,
  completionKey,
}: {
  system?: Exclude<System, 'daily'>;
  initial?: BirthInput & { displayName?: string };
  profileMode?: boolean;
  signedIn?: boolean;
  completionKey?: MessageKey;
  onComplete?: (birth: BirthInput, displayName: string) => void | Promise<void>;
}) {
  const t = useCopy();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [birth, setBirth] = useState<BirthInput>(() => initialBirth(initial));
  const [step, setStep] = useState(1);
  const stepHeading = useRef<HTMLHeadingElement | null>(null);
  const previousStep = useRef(1);
  // DESIGN-GAP: Move keyboard focus to the new step heading only after a step change, never on initial page load.
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);
  const [touched, setTouched] = useState(false);
  const [precise, setPrecise] = useState(Boolean(initial));
  const [name, setName] = useState(initial?.displayName ?? '');
  const [solar, setSolar] = useState(true);
  const [ziHour, setZiHour] = useState('zi_unified');
  const [house, setHouse] = useState('placidus');
  const [leap, setLeap] = useState('split');
  const [manual, setManual] = useState(false);
  // DESIGN-GAP: Disable pre-hydration edits so native checkbox changes cannot be lost before React attaches handlers.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [working, setBusy] = useState(false);
  const { pending, run } = useSubmitTransition();
  const busy = working || pending;
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!signedIn && !initial)
      void readAnonymous()
        .then((data) => {
          if (active && data?.profile) {
            const saved = data.profile;
            setBirth((current) => (current.year === 0 ? saved : current));
            setName((current) => current || data.displayName || '');
          }
        })
        .catch(() => {
          if (active) setError('report.storageError');
        });
    return () => {
      active = false;
    };
  }, [signedIn, initial]);
  const preview = useMemo(() => {
    try {
      return normalizeBirth(birth, locale);
    } catch {
      return null;
    }
  }, [birth, locale]);
  const validError = touched ? birthError(birth, locale) : null;
  const change = (patch: Partial<BirthInput>) => {
    setTouched(true);
    setRequestId(null);
    setError(null);
    // DESIGN-GAP: Manual changes to birth facts clear trial provenance; a display-name-only edit retains it.
    setBirth((current) => ({
      ...current,
      ...patch,
      timeSource: undefined,
      rectificationConfidence: undefined,
    }));
  };
  const changeYear = (year: number) => {
    const patch: Partial<BirthInput> = { year };
    if (
      birth.calendar === 'lunar' &&
      birth.isLeapMonth &&
      !lunarMonths(Math.max(1900, Math.min(year, 2100))).some((m) => m.month === -birth.month)
    )
      patch.isLeapMonth = false;
    change(patch);
  };
  const validate = async () => {
    setTouched(true);
    const e = birthError(birth, locale);
    if (e) {
      setError(e);
      return false;
    }
    if (isUnderThirteen(birth, locale)) {
      await blockAgeAction();
      router.replace('/age-restricted');
      return false;
    }
    return true;
  };
  const submit = async () => {
    if (system === 'ziwei' && birth.timeUnknown && !profileMode && !onComplete) {
      setError('errors.E_REQUIRES_BIRTH_TIME');
      return;
    }
    if (!(await validate())) return;
    if (onComplete) {
      setBusy(true);
      try {
        await onComplete(BirthInputSchema.parse(birth), name);
      } catch {
        setError('report.error.E_INTERNAL');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setError(null);
    const began = performance.now();
    try {
      if (profileMode) {
        if (signedIn) {
          const saved = await upsertProfileAction(birth, name, locale);
          if (!saved.ok) {
            setError(`report.error.${saved.error.code}`);
            return;
          }
        } else
          await updateAnonymous((data) => ({
            ...data,
            profile: BirthInputSchema.parse(birth),
            displayName: name,
          }));
        toast.success(t('form.birth.saved'));
        router.push('/me');
        return;
      }
      const idempotencyKey = requestId ?? crypto.randomUUID();
      setRequestId(idempotencyKey);
      // DESIGN-GAP: Shared advanced controls send only parameters supported by the chosen system's current engine.
      const school: Record<string, string | number | boolean> | undefined =
        system === 'bazi'
          ? { useApparentSolarTime: solar, ziHour }
          : system === 'ziwei'
            ? {
                useApparentSolarTime: solar,
                leapMonth:
                  leap === 'split' ? 'split_by_15' : leap === 'current' ? 'as_prev' : 'as_next',
              }
            : system === 'astrology'
              ? { houseSystem: house }
              : undefined;
      const req: ReadingRequest = {
        system,
        birth: BirthInputSchema.parse(birth),
        locale,
        displayName: name,
        options: school ? { school } : undefined,
        idempotencyKey,
      };
      const result = await createReadingAction(req);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 1200 - (performance.now() - began))),
      );
      if (!result.ok) {
        if (result.error.code === 'E_AGE_RESTRICTED') {
          router.replace('/age-restricted');
          return;
        }
        setError(`report.error.${result.error.code}`);
        return;
      }
      if ('readingId' in result.data && result.data.readingId) {
        router.push(`/${system}/r/${result.data.readingId}`);
        return;
      }
      const localId = crypto.randomUUID();
      const local: LocalReading = {
        id: localId,
        system,
        createdAt: new Date().toISOString(),
        title: null,
        request: req,
        ...result.data,
      };
      await updateAnonymous((data) => ({
        ...data,
        profile: req.birth,
        displayName: name,
        readings: [local, ...data.readings].slice(0, 50),
      }));
      router.push(`/${system}/r/local/${localId}`);
    } catch {
      setError('report.storageError');
    } finally {
      setBusy(false);
    }
  };
  const openRectification = async () => {
    setBusy(true);
    try {
      const draft = BirthInputSchema.safeParse(birth);
      // DESIGN-GAP: The encrypted device draft bridges routes for guests and signed-in users without putting birth facts in URLs.
      await updateAnonymous((data) => ({
        ...data,
        settings: {
          ...data.settings,
          rectificationDraft: draft.success ? { birth: draft.data, displayName: name } : null,
        },
      }));
      router.push('/rectify');
    } catch {
      setError('report.storageError');
    } finally {
      setBusy(false);
    }
  };
  const setPlace = (patch: Partial<NonNullable<BirthInput['place']>>) =>
    change({
      place: {
        name: birth.place?.name ?? t('form.birth.manual'),
        lat: birth.place?.lat ?? 0,
        lng: birth.place?.lng ?? 0,
        tz: birth.place?.tz ?? (locale !== 'en' ? 'Asia/Shanghai' : 'UTC'),
        ...patch,
      },
    });
  return (
    <section className="birth-shell">
      <p className="eyebrow">{t('form.birth.step', { step })}</p>
      <h1 className="type-h1">{t('form.birth.title')}</h1>
      <form
        className="birth-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 1)
            run(async () => {
              if (await validate()) setStep(2);
            });
          else run(submit);
        }}
      >
        <fieldset disabled={!hydrated || busy} className="birth-controls">
          <h2 className="type-h2" ref={stepHeading} tabIndex={-1}>
            {t(step === 1 ? 'form.birth.dateTime' : 'form.birth.placeGender')}
          </h2>
          {step === 1 ? (
            <>
              <BirthDateFields
                birth={birth}
                change={change}
                changeYear={changeYear}
                precise={precise}
                setPrecise={setPrecise}
                busy={busy}
                canRectify={!onComplete}
                openRectification={openRectification}
                system={system}
                profileMode={profileMode}
              />
            </>
          ) : (
            <>
              <BirthPlaceFields
                birth={birth}
                change={change}
                manual={manual}
                setManual={setManual}
                setPlace={setPlace}
                setError={setError}
                preview={preview}
                solar={solar}
              />
              <label className="birth-field">
                {t('form.birth.gender')}
                <select
                  aria-label={t('form.birth.gender')}
                  value={birth.gender}
                  onChange={(e) => change({ gender: e.target.value as BirthInput['gender'] })}
                >
                  {(['male', 'female', 'unspecified'] as const).map((g) => (
                    <option key={g} value={g}>
                      {t(`form.birth.gender.${g}`)}
                    </option>
                  ))}
                </select>
              </label>
              {birth.gender === 'unspecified' ? (
                <p className="muted">{t('form.birth.gender.unspecified.note')}</p>
              ) : null}
              <label className="birth-field">
                {t('form.birth.displayName')}
                <input
                  maxLength={80}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setRequestId(null);
                  }}
                />
              </label>
              <BirthSchoolFields
                solar={solar}
                setSolar={setSolar}
                ziHour={ziHour}
                setZiHour={setZiHour}
                house={house}
                setHouse={setHouse}
                leap={leap}
                setLeap={setLeap}
                setRequestId={setRequestId}
              />
            </>
          )}
          {error || validError ? (
            <p role="alert" className="form-error">
              {t((error ?? validError) as MessageKey)}
            </p>
          ) : null}
          <div className="hero-actions">
            {step === 2 ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep(1)}>
                {t('form.birth.back')}
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={busy || (system === 'ziwei' && birth.timeUnknown && !profileMode)}
            >
              {t(
                busy
                  ? step === 1
                    ? 'common.loading'
                    : 'form.birth.saving'
                  : step === 1
                    ? 'form.birth.next'
                    : onComplete
                      ? (completionKey ?? 'rectification.start')
                      : profileMode
                        ? 'form.birth.save'
                        : 'form.birth.submit',
              )}
            </Button>
          </div>
        </fieldset>
      </form>
      {!signedIn ? <p className="muted">{t('report.localNotice')}</p> : null}
      {busy && !profileMode ? <DivinationLoader /> : null}
    </section>
  );
}
