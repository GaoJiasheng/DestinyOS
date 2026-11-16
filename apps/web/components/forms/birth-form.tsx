'use client';
import { useSubmitTransition } from './use-submit-transition';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { normalizeBirth } from '@tianji/engine/common';
import { BirthInputSchema, type BirthInput, type Locale, type System } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { useRouter } from '@/i18n/navigation';
import { initialBirth } from '@/lib/birth-form-initial';
import { birthError, isUnderThirteen, yearPatch } from '@/lib/birth-form';
import {
  birthFields,
  fieldIds,
  stepOneIssues,
  stepTwoIssues,
  type BirthField,
  type FieldIssue,
} from '@/lib/birth-form-validate';
import { safeReturnTo, setUrlStep, urlStep } from '@/lib/birth-form-draft';
import {
  createBirthReading,
  networkError,
  defaultSchool,
  saveBirthProfile,
  saveRectificationDraft,
  schoolOptions,
  submitLabel,
  type School,
} from '@/lib/birth-form-submit';
import { afterConsent } from '@/lib/consent';
import { Button } from '@/components/ui/button';
import { BirthPersonFields } from './birth-person-fields';
import { BirthDateFields } from './birth-date-fields';
import { BirthPlaceFields } from './birth-place-fields';
import { AgeConfirmDialog, BirthTargetChoice } from './birth-form-parts';
import type { BirthComplete, BirthTarget } from './birth-form-parts';
import { useBirthDraft } from './use-birth-draft';
import { useBirthTarget } from './use-birth-target';
import { useAgeQuestion } from './use-age-question';
import { DivinationLoader } from '@/components/ui/divination-loader';
/** Two-step shared birth editor with inline validation, a session draft and privacy-safe submission. */
export function BirthForm({
  system = 'bazi',
  initial,
  profileMode = false,
  signedIn = false,
  onComplete,
  completionKey,
  draftKey,
  prefillProfile = true,
  subject,
}: {
  system?: Exclude<System, 'daily'>;
  /** `relation` comes with a saved profile; anything but 'self' is someone else's birth. */
  initial?: BirthInput & { displayName?: string; relation?: string };
  /** Fixed by the host (a synastry partner is always someone else); skips the age question. */
  subject?: BirthTarget;
  profileMode?: boolean;
  signedIn?: boolean;
  completionKey?: MessageKey;
  onComplete?: BirthComplete;
  /** Session draft slot; embedded forms keep no draft unless the host names one. */
  draftKey?: string;
  /** Embedded forms may start from the device profile (rectification) or blank (a synastry partner). */
  prefillProfile?: boolean;
}) {
  const t = useCopy();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const embedded = Boolean(onComplete);
  const Title = embedded ? 'h2' : 'h1';
  const slot = embedded ? (draftKey ?? null) : (draftKey ?? (profileMode ? 'profile' : system));
  const [birth, setBirth] = useState<BirthInput>(() => initialBirth(initial));
  const [step, setStep] = useState<1 | 2>(1);
  const stepHeading = useRef<HTMLHeadingElement | null>(null);
  const previousStep = useRef(1);
  // DESIGN-GAP: Move keyboard focus to the new step heading only after a step change, never on initial page load.
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);
  const [precise, setPrecise] = useState(Boolean(initial));
  const [name, setName] = useState(initial?.displayName ?? '');
  const [school, setSchool] = useState<School>(defaultSchool);
  const { solar } = school;
  const [manual, setManual] = useState(false);
  // DESIGN-GAP: Disable pre-hydration edits so native checkbox changes cannot be lost before React attaches handlers.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [working, setBusy] = useState(false);
  const { pending, run } = useSubmitTransition();
  const busy = working || pending;
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [blurred, setBlurred] = useState<ReadonlySet<BirthField>>(new Set());
  const [attempted, setAttempted] = useState(0);
  const [cityPending, setCityPending] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const dirty = useRef(false);
  const baseId = useId();
  const ids = useMemo(() => fieldIds(baseId), [baseId]);
  const { target, setTarget, choose, hasSaved } = useBirthTarget({
    signedIn,
    hasInitial: Boolean(initial),
    embedded,
    profileMode,
    prefillProfile,
    dirty,
    setBirth,
    setName,
    setPrecise,
    setError,
    known: subject ?? (initial?.relation && initial.relation !== 'self' ? 'other' : undefined),
  });
  const age = useAgeQuestion({
    // The profile editor saves the user's own birth, so it cannot switch to someone else.
    selfOnly: profileMode && !embedded,
    focusYear: () => setTimeout(() => document.getElementById(ids.year)?.focus(), 0),
    onOther: () => {
      setTarget('other');
      if (step !== 1) return;
      setStep(2);
      if (slot) setUrlStep(2, 'push');
    },
  });
  const draft = useBirthDraft({
    slot,
    basis: JSON.stringify(initial ?? null),
    dirty,
    snapshot: { birth, name, precise, school, manual, target, step },
    restore: (d) => {
      if (typeof d.birth?.year !== 'number') return false;
      setBirth(d.birth);
      setName(d.name);
      setPrecise(d.precise);
      setSchool({ ...defaultSchool, ...d.school });
      setManual(d.manual);
      if (d.target) setTarget(d.target);
      return d.step === 2 && stepOneIssues(d.birth, d.precise).length === 0;
    },
    setStep,
  });
  useEffect(() => {
    setReturnTo(safeReturnTo(new URL(window.location.href).searchParams.get('from')));
  }, []);
  const chooseTarget = (next: BirthTarget) => {
    setRequestId(null);
    age.clearIssue();
    choose(next);
  };
  const preview = useMemo(() => {
    try {
      return normalizeBirth(birth, locale);
    } catch {
      return null;
    }
  }, [birth, locale]);
  // Errors appear after a field is left or a step is submitted, never on the first keystroke.
  const stepIssues = step === 1 ? stepOneIssues(birth, precise) : stepTwoIssues(birth, cityPending);
  const visible = stepIssues.filter((i) => attempted >= step || blurred.has(i.field));
  if (step === 1 && age.issue && !visible.some((i) => i.field === 'year'))
    visible.unshift(age.issue);
  const focusFirst = (issues: FieldIssue[]) => {
    const first = birthFields.find((f) => issues.some((i) => i.field === f));
    if (first) setTimeout(() => document.getElementById(ids[first])?.focus(), 0);
  };
  const change = (patch: Partial<BirthInput>) => {
    dirty.current = true;
    setRequestId(null);
    setError(null);
    age.clearIssue();
    // DESIGN-GAP: Manual changes to birth facts clear trial provenance; a display-name-only edit retains it.
    setBirth((current) => ({
      ...current,
      ...patch,
      timeSource: undefined,
      rectificationConfidence: undefined,
    }));
  };
  const changeYear = (year: number) => change(yearPatch(birth, year));
  const back = () => {
    if (urlStep() === 2 && slot) window.history.back();
    else setStep(1);
  };
  /** Step one: a complete date and hour, then the age check (dialog unless the user already said it is someone else). */
  const checkStepOne = () => {
    const issues = stepOneIssues(birth, precise);
    if (issues.length) {
      setAttempted((a) => Math.max(a, 1));
      if (step !== 1) {
        setStep(1);
        setUrlStep(1, 'replace');
      }
      focusFirst(issues);
      return false;
    }
    // The place is validated on step two, so a stale zone cannot trap the user on step one.
    const dateOnly = { ...birth, place: undefined };
    const engine = birthError(dateOnly, locale);
    if (engine) {
      setError(engine);
      return false;
    }
    // Under 13 is allowed only for someone else's birthday; the user's own is asked about first.
    if (target !== 'other' && isUnderThirteen(dateOnly, locale)) {
      age.ask();
      return false;
    }
    return true;
  };
  const checkStepTwo = () => {
    const issues = stepTwoIssues(birth, cityPending);
    if (issues.length) {
      setAttempted(2);
      if (issues.some((i) => i.field === 'tz')) setManual(true);
      focusFirst(issues);
      return false;
    }
    const engine = birthError(birth, locale);
    if (engine) setError(engine);
    return !engine;
  };
  const finish = (href: string) => {
    if (slot) draft.clear();
    router.push(href);
  };
  const submit = async () => {
    if (system === 'ziwei' && birth.timeUnknown && !profileMode && !embedded) {
      setError('errors.E_REQUIRES_BIRTH_TIME');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (onComplete) {
        try {
          await onComplete(BirthInputSchema.parse(birth), name, target ?? 'self');
          if (slot) draft.clear();
          setUrlStep(1, 'replace');
        } catch {
          setError('report.error.E_INTERNAL');
        }
        return;
      }
      if (profileMode) {
        const result = await saveBirthProfile(birth, name, locale, signedIn);
        if ('error' in result) return setError(result.error);
        toast.success(t('form.birth.saved'));
        return finish(returnTo ?? '/me');
      }
      const idempotencyKey = requestId ?? crypto.randomUUID();
      setRequestId(idempotencyKey);
      const outcome = await createBirthReading({
        system,
        birth,
        name,
        locale,
        school: schoolOptions(system, school),
        idempotencyKey,
        writeProfile: target !== 'other',
        subject: target ?? 'self',
      });
      if ('ageRestricted' in outcome) return router.replace('/age-restricted');
      if ('error' in outcome) return setError(outcome.error);
      finish(outcome.href);
    } catch {
      setError(networkError);
    } finally {
      setBusy(false);
    }
  };
  const openRectification = async () => {
    setBusy(true);
    try {
      await saveRectificationDraft(birth, name);
      router.push('/rectify');
    } catch {
      setError('report.storageError');
    } finally {
      setBusy(false);
    }
  };
  // A signed-in owner without a profile is asked too: their own first chart becomes the profile.
  const accountFirst = signedIn && !initial && !embedded && !profileMode;
  const showTarget =
    accountFirst || (!signedIn && !embedded && !profileMode && (hasSaved || target !== null));
  return (
    <section className="birth-shell">
      <p className="eyebrow">{t('form.birth.step', { step })}</p>
      {/* Embedded forms sit under their host page's h1. */}
      <Title className="type-h1">{t('form.birth.title')}</Title>
      <form
        className="birth-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 1) {
            if (checkStepOne()) {
              setStep(2);
              if (slot) setUrlStep(2, 'push');
            }
          } else if (checkStepOne() && checkStepTwo()) afterConsent(() => run(submit));
        }}
      >
        <fieldset disabled={!hydrated || busy} className="birth-controls">
          <h2 className="type-h2" ref={stepHeading} tabIndex={-1}>
            {t(step === 1 ? 'form.birth.dateTime' : 'form.birth.placeGender')}
          </h2>
          {step === 1 ? (
            <>
              {showTarget ? (
                <BirthTargetChoice
                  value={target ?? (accountFirst ? 'self' : 'other')}
                  onChange={chooseTarget}
                />
              ) : null}
              <BirthDateFields
                birth={birth}
                change={change}
                changeYear={changeYear}
                precise={precise}
                setPrecise={(value) => {
                  dirty.current = true;
                  setPrecise(value);
                }}
                busy={busy}
                canRectify={!embedded}
                openRectification={openRectification}
                system={system}
                profileMode={profileMode}
                ids={ids}
                issues={visible}
                onBlurField={(f) => setBlurred((s) => new Set(s).add(f))}
                selfAutofill={!embedded && (profileMode || (!signedIn && target !== 'other'))}
              />
            </>
          ) : (
            <>
              <BirthPlaceFields
                birth={birth}
                change={change}
                manual={manual}
                setManual={setManual}
                setError={setError}
                preview={preview}
                solar={solar}
                ids={ids}
                issues={visible}
                onCityPending={setCityPending}
              />
              <BirthPersonFields
                gender={birth.gender}
                onGender={(gender) => change({ gender })}
                name={name}
                onName={(value) => {
                  dirty.current = true;
                  setName(value);
                  setRequestId(null);
                }}
                school={school}
                setSchool={(next) => {
                  setSchool(next);
                  setRequestId(null);
                }}
              />
            </>
          )}
          {error ? (
            <p role="alert" className="form-error">
              {t(error as MessageKey)}
            </p>
          ) : null}
          <div className="hero-actions birth-actions">
            {step === 2 ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={back}>
                {t('form.birth.back')}
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={busy || (system === 'ziwei' && birth.timeUnknown && !profileMode)}
            >
              {t(submitLabel({ busy, step, embedded, profileMode, completionKey: completionKey }))}
            </Button>
          </div>
        </fieldset>
      </form>
      {!signedIn ? <p className="muted">{t('report.localNotice')}</p> : null}
      {busy && !profileMode ? <DivinationLoader /> : null}
      <AgeConfirmDialog {...age.dialog} />
    </section>
  );
}
