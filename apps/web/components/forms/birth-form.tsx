'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { normalizeBirth } from '@tianji/engine/common';
import { BirthInputSchema, type BirthInput, type Locale, type System } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { useRouter } from '@/i18n/navigation';
import { birthError, isUnderThirteen, lunarMonths } from '@/lib/birth-form';
import { createReadingAction, upsertProfileAction, blockAgeAction } from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { ReadingRequest, LocalReading } from '@/lib/reading-schema';
import { Button } from '@/components/ui/button';
import { CitySearch } from './city-search';
import { HourBranchPicker } from './hour-branch-picker';
import { LunarDatePicker } from './lunar-date-picker';
import { ZiweiTimeRequired } from '@/components/charts/ziwei-grid';
import { DivinationLoader } from '@/components/divination-loader';
/** Two-step shared birth editor with live calendar/timezone validation and privacy-safe submission. */
export function BirthForm({
  system = 'bazi',
  initial,
  profileMode = false,
  signedIn = false,
}: {
  system?: Exclude<System, 'daily'>;
  initial?: BirthInput & { displayName?: string };
  profileMode?: boolean;
  signedIn?: boolean;
}) {
  const t = useCopy();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [birth, setBirth] = useState<BirthInput>(() => {
    if (initial) {
      const { calendar, year, month, day, isLeapMonth, hour, minute, timeUnknown, place, gender } =
        initial;
      return { calendar, year, month, day, isLeapMonth, hour, minute, timeUnknown, place, gender };
    }
    return {
      calendar: 'gregorian',
      year: 0,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      timeUnknown: false,
      gender: 'unspecified',
    };
  });
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
  const [busy, setBusy] = useState(false);
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
    setBirth((current) => ({ ...current, ...patch }));
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
    if (system === 'ziwei' && birth.timeUnknown && !profileMode) {
      setError('errors.E_REQUIRES_BIRTH_TIME');
      return;
    }
    if (!(await validate())) return;
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
  const setPlace = (patch: Partial<NonNullable<BirthInput['place']>>) =>
    change({
      place: {
        name: birth.place?.name ?? t('form.birth.manual'),
        lat: birth.place?.lat ?? 0,
        lng: birth.place?.lng ?? 0,
        tz: birth.place?.tz ?? (locale === 'zh' ? 'Asia/Shanghai' : 'UTC'),
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
            void validate().then((ok) => {
              if (ok) setStep(2);
            });
          else void submit();
        }}
      >
        <fieldset disabled={!hydrated || busy} className="birth-controls">
          <h2 className="type-h2" ref={stepHeading} tabIndex={-1}>
            {t(step === 1 ? 'form.birth.dateTime' : 'form.birth.placeGender')}
          </h2>
          {step === 1 ? (
            <>
              <div className="birth-segment" role="group" aria-label={t('form.birth.dateTime')}>
                {(['gregorian', 'lunar'] as const).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={birth.calendar === c ? 'default' : 'secondary'}
                    aria-pressed={birth.calendar === c}
                    onClick={() =>
                      change({ calendar: c, isLeapMonth: false, day: Math.min(birth.day, 28) })
                    }
                  >
                    {t(`form.birth.calendar.${c}`)}
                  </Button>
                ))}
              </div>
              <div className="birth-grid">
                <label className="birth-field">
                  {t('form.birth.year')}
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    required
                    value={birth.year || ''}
                    onChange={(e) => changeYear(Number(e.target.value))}
                  />
                </label>
                {birth.calendar === 'lunar' ? (
                  <LunarDatePicker
                    year={birth.year}
                    month={birth.isLeapMonth ? -birth.month : birth.month}
                    day={birth.day}
                    onChange={(m, d) => change({ month: Math.abs(m), day: d, isLeapMonth: m < 0 })}
                  />
                ) : (
                  <>
                    <label className="birth-field">
                      {t('form.birth.month')}
                      <input
                        type="number"
                        min={1}
                        max={12}
                        required
                        value={birth.month}
                        onChange={(e) => change({ month: Number(e.target.value) })}
                      />
                    </label>
                    <label className="birth-field">
                      {t('form.birth.day')}
                      <input
                        type="number"
                        min={1}
                        max={31}
                        required
                        value={birth.day}
                        onChange={(e) => change({ day: Number(e.target.value) })}
                      />
                    </label>
                  </>
                )}
              </div>
              <label className="birth-check">
                <input
                  type="checkbox"
                  checked={precise}
                  disabled={birth.timeUnknown}
                  onChange={(e) => setPrecise(e.target.checked)}
                />
                {t('form.birth.precise')}
              </label>
              {precise ? (
                <label className="birth-field">
                  {t('form.birth.time')}
                  <input
                    type="time"
                    disabled={birth.timeUnknown}
                    value={`${String(birth.hour ?? 0).padStart(2, '0')}:${String(birth.minute ?? 0).padStart(2, '0')}`}
                    onChange={(e) => {
                      const [hour, minute] = e.target.value.split(':').map(Number);
                      change({ hour, minute });
                    }}
                  />
                </label>
              ) : (
                <HourBranchPicker
                  hour={birth.hour ?? 0}
                  onChange={(hour) => change({ hour, minute: 0 })}
                  disabled={birth.timeUnknown}
                />
              )}
              <label className="birth-check">
                <input
                  type="checkbox"
                  checked={birth.timeUnknown}
                  onChange={(e) => change({ timeUnknown: e.target.checked })}
                />
                {t('form.birth.timeUnknown')}
              </label>
              {birth.timeUnknown ? (
                <p className="notice">{t('form.birth.timeUnknown.help')}</p>
              ) : null}
              {birth.timeUnknown && system === 'ziwei' && !profileMode ? (
                <ZiweiTimeRequired />
              ) : null}
            </>
          ) : (
            <>
              <CitySearch place={birth.place} onSelect={(place) => change({ place })} />
              <p className="muted">{t('form.birth.placeOptional')}</p>
              <details open={manual} onToggle={(e) => setManual(e.currentTarget.open)}>
                <summary>{t('form.birth.manual')}</summary>
                <div className="birth-grid">
                  <label className="birth-field">
                    {t('form.birth.lat')}
                    <input
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      value={birth.place?.lat ?? ''}
                      onChange={(e) => setPlace({ lat: Number(e.target.value) })}
                    />
                  </label>
                  <label className="birth-field">
                    {t('form.birth.lng')}
                    <input
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      value={birth.place?.lng ?? ''}
                      onChange={(e) => setPlace({ lng: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label className="birth-field">
                  {t('form.birth.tz')}
                  <input
                    list="iana-timezones"
                    value={birth.place?.tz ?? ''}
                    onChange={(e) => setPlace({ tz: e.target.value })}
                  />
                  <datalist id="iana-timezones">
                    {Intl.supportedValuesOf('timeZone').map((tz) => (
                      <option key={tz} value={tz} />
                    ))}
                  </datalist>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void fetch(
                      `/api/v1/geo/tz?lat=${birth.place?.lat ?? ''}&lng=${birth.place?.lng ?? ''}`,
                    )
                      .then((r) => r.json())
                      .then((raw: unknown) => {
                        if (
                          raw &&
                          typeof raw === 'object' &&
                          'data' in raw &&
                          raw.data &&
                          typeof raw.data === 'object' &&
                          'tz' in raw.data &&
                          typeof raw.data.tz === 'string'
                        )
                          setPlace({ tz: raw.data.tz });
                        else setError('engine.errors.E_INVALID_INPUT');
                      })
                      .catch(() => setError('report.error.E_INTERNAL'));
                  }}
                >
                  {t('form.birth.resolveTz')}
                </Button>
              </details>
              {preview?.warnings.some((w) => w.code === 'W_DST_PERIOD') ? (
                <p className="notice">{t('form.birth.dst.note')}</p>
              ) : null}
              {solar &&
              preview?.solarTime.offsetMinutes !== null &&
              preview?.solarTime.offsetMinutes !== undefined ? (
                <p className="notice">
                  {t('form.birth.solarTime.note', {
                    minutes: Math.round(preview.solarTime.offsetMinutes),
                  })}
                </p>
              ) : null}
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
              <details>
                <summary>{t('form.birth.advanced')}</summary>
                <label className="birth-check">
                  <input
                    type="checkbox"
                    checked={solar}
                    onChange={(e) => {
                      setSolar(e.target.checked);
                      setRequestId(null);
                    }}
                  />
                  {t('form.birth.apparentSolarTime')}
                </label>
                <label className="birth-field">
                  {t('form.birth.ziHour')}
                  <select
                    aria-label={t('form.birth.ziHour')}
                    value={ziHour}
                    onChange={(e) => {
                      setZiHour(e.target.value);
                      setRequestId(null);
                    }}
                  >
                    {['zi_unified', 'zi_split'].map((s) => (
                      <option key={s} value={s}>
                        {t(`form.birth.${s}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="birth-field">
                  {t('form.birth.houseSystem')}
                  <select
                    aria-label={t('form.birth.houseSystem')}
                    value={house}
                    onChange={(e) => setHouse(e.target.value)}
                  >
                    {['placidus', 'whole_sign', 'equal', 'koch'].map((h) => (
                      <option key={h} value={h} disabled={h === 'koch'}>
                        {t(`form.birth.house.${h}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="birth-field">
                  {t('form.birth.leapRule')}
                  <select
                    aria-label={t('form.birth.leapRule')}
                    value={leap}
                    onChange={(e) => setLeap(e.target.value)}
                  >
                    {['split', 'current', 'next'].map((l) => (
                      <option key={l} value={l}>
                        {t(`form.birth.leap.${l}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </details>
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
                step === 1
                  ? 'form.birth.next'
                  : busy
                    ? 'form.birth.saving'
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
