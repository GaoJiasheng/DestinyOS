'use client';
import { useSubmitTransition } from '@/components/forms/use-submit-transition';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  BirthInputSchema,
  RectificationPeriodSchema,
  RECTIFICATION_QUESTION_KEYS,
  type BirthInput,
  type Locale,
  type RectificationAnswers,
} from '@tianji/shared';
import type { RankedRectificationCandidate } from '@tianji/engine/rectification';
import { createReadingAction, upsertProfileAction, blockAgeAction } from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading, ReadingRequest } from '@/lib/reading-schema';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
// DESIGN-GAP: Existing profiles enter the questionnaire directly; defer the birth editor and its calendar dependencies until needed.
const BirthForm = dynamic(() => import('./birth-form').then((module) => module.BirthForm));
const draftSchema = z.object({ birth: BirthInputSchema, displayName: z.string() });

/** Keep answers and candidate charts on-device; only a selected trial reaches the existing profile/report actions. */
export function RectificationWizard({
  initial,
  signedIn,
}: {
  initial?: BirthInput & { displayName?: string };
  signedIn: boolean;
}) {
  const { pending, run } = useSubmitTransition();
  const t = useTranslations('rectification');
  const intl = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [birth, setBirth] = useState<BirthInput | null>(null);
  const [name, setName] = useState(initial?.displayName ?? '');
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [working, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<RectificationAnswers['answers']>(
    Array.from({ length: 7 }, () => 'unsure' as const),
  );
  const [period, setPeriod] = useState<RectificationAnswers['period']>('uncertain');
  const [candidates, setCandidates] = useState<RankedRectificationCandidate[] | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const trialRequests = useRef(new Map<string, ReadingRequest>());
  const busy = working || pending;
  useEffect(() => {
    let active = true;
    void readAnonymous()
      .then((data) => {
        if (!active) return;
        const draft = draftSchema.safeParse(data?.settings.rectificationDraft);
        const input = draft.success
          ? draft.data.birth
          : initial
            ? BirthInputSchema.parse(initialBirth(initial))
            : data?.profile;
        if (input) setBirth(input);
        setName(
          draft.success
            ? draft.data.displayName
            : (initial?.displayName ?? data?.displayName ?? ''),
        );
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError('report.storageError');
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [initial]);
  useEffect(() => {
    if (candidates) resultHeading.current?.focus();
  }, [candidates]);
  const rank = async () => {
    if (!birth) return;
    setBusy(true);
    setError(null);
    try {
      const { isUnderThirteen } = await import('@/lib/birth-form');
      if (isUnderThirteen(birth, locale)) {
        await blockAgeAction();
        router.replace('/age-restricted');
        return;
      }
      const { rectifyBirth } = await import('@tianji/engine/rectification');
      const ranked = rectifyBirth(birth, { period, answers }, new Date().toISOString(), locale);
      trialRequests.current.clear();
      setCandidates(ranked);
    } catch {
      setError('engine.errors.E_INVALID_INPUT');
    } finally {
      setBusy(false);
    }
  };
  const tryCandidate = async (
    candidate: RankedRectificationCandidate,
    system: 'ziwei' | 'bazi',
  ) => {
    setBusy(true);
    setError(null);
    try {
      const selected = BirthInputSchema.parse({
        ...candidate.birth,
        timeSource: 'rectified',
        rectificationConfidence: candidate.confidence,
      });
      if (signedIn) {
        const saved = await upsertProfileAction(selected, name, locale);
        if (!saved.ok) {
          setError(`report.error.${saved.error.code}`);
          return;
        }
      } else {
        await updateAnonymous((data) => ({
          ...data,
          profile: selected,
          displayName: name,
          settings: { ...data.settings, rectificationDraft: null },
        }));
      }
      // DESIGN-GAP: Keep a per-candidate/system idempotency key across retries to avoid duplicate trial reports.
      const key = `${candidate.branch}:${system}`;
      const request: ReadingRequest = trialRequests.current.get(key) ?? {
        system,
        birth: signedIn ? undefined : selected,
        locale,
        displayName: name,
        idempotencyKey: crypto.randomUUID(),
      };
      const req = request;
      trialRequests.current.set(key, req);
      const result = await createReadingAction(req);
      if (!result.ok) {
        setError(`report.error.${result.error.code}`);
        return;
      }
      if ('readingId' in result.data && result.data.readingId) {
        await updateAnonymous((data) => ({
          ...data,
          settings: { ...data.settings, rectificationDraft: null },
        }));
        router.push(`/${system}/r/${result.data.readingId}`);
        return;
      }
      const id = crypto.randomUUID();
      const reading: LocalReading = {
        ...result.data,
        id,
        system,
        request: req,
        createdAt: new Date().toISOString(),
        title: null,
      };
      await updateAnonymous((data) => ({
        ...data,
        readings: [reading, ...data.readings].slice(0, 50),
      }));
      router.push(`/${system}/r/local/${id}`);
    } catch {
      setError('report.storageError');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="status-page rectification-page" aria-busy={busy}>
      <h1 className="type-h1">{t('title')}</h1>
      <p className="notice">{t('intro')}</p>
      {error ? <p role="alert">{intl(error)}</p> : null}
      {!ready ? (
        <p role="status">{t('loading')}</p>
      ) : !birth || editing ? (
        <BirthForm
          initial={birth ? { ...birth, displayName: name } : undefined}
          signedIn={signedIn}
          onComplete={(input, displayName) => {
            setBirth(input);
            setName(displayName);
            setEditing(false);
            setCandidates(null);
          }}
        />
      ) : candidates ? (
        <>
          <h2 ref={resultHeading} tabIndex={-1}>
            {t('results')}
          </h2>
          <p>{t('resultHelp')}</p>
          <div className="rectification-results">
            {candidates.slice(0, 3).map((candidate, index) => (
              <article
                className="report-card"
                data-testid="rectification-candidate"
                key={candidate.branch}
              >
                <h3>
                  {t('candidate', { rank: index + 1 })} ·{' '}
                  {intl(`bazi.branches.${candidate.branch}`)}
                </h3>
                <p>{t('clock', { hour: candidate.hour.toString().padStart(2, '0') })}</p>
                <p>{t('similarity', { percent: Math.round(candidate.confidence * 100) })}</p>
                <p>{t(`feature.${candidate.branch}`)}</p>
                <dl>
                  <dt>{t('lifeStars')}</dt>
                  <dd>
                    {candidate.lifeStars
                      .map((star) => intl(`ziwei.chart.star.${star}`))
                      .join(' · ')}
                  </dd>
                  <dt>{t('hourPillar')}</dt>
                  <dd>
                    {intl(`bazi.stems.${candidate.hourPillar.stem}`)} ·{' '}
                    {intl(`bazi.branches.${candidate.hourPillar.branch}`)} ·{' '}
                    {intl(`bazi.tenGods.${candidate.hourPillar.tenGod}`)}
                  </dd>
                </dl>
                <div className="hero-actions">
                  <Button disabled={busy} action={() => tryCandidate(candidate, 'ziwei')}>
                    {t('try')}
                  </Button>
                  <Button
                    disabled={busy}
                    variant="secondary"
                    action={() => tryCandidate(candidate, 'bazi')}
                  >
                    {t('tryBazi')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <details>
            <summary>{t('allCandidates')}</summary>
            <ol>
              {candidates.map((candidate) => (
                <li key={candidate.branch}>
                  {intl(`bazi.branches.${candidate.branch}`)} ·{' '}
                  {t('similarity', { percent: Math.round(candidate.confidence * 100) })} ·{' '}
                  {t(`feature.${candidate.branch}`)}
                </li>
              ))}
            </ol>
          </details>
          <Button disabled={busy} variant="secondary" onClick={() => setCandidates(null)}>
            {t('retry')}
          </Button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(rank);
          }}
        >
          <label className="birth-field">
            {t('period')}
            <select
              value={period}
              disabled={busy}
              onChange={(event) => setPeriod(RectificationPeriodSchema.parse(event.target.value))}
            >
              {RectificationPeriodSchema.options.map((value) => (
                <option value={value} key={value}>
                  {t(`periods.${value}`)}
                </option>
              ))}
            </select>
          </label>
          {RECTIFICATION_QUESTION_KEYS.map((question, index) => (
            <fieldset className="report-card" key={question} disabled={busy}>
              <legend>{t(`questions.${question}`)}</legend>
              {(['a', 'b', 'c', 'unsure'] as const).map((answer) => (
                <label className="birth-check" key={answer}>
                  <input
                    type="radio"
                    name={question}
                    value={answer}
                    checked={answers[index] === answer}
                    onChange={() =>
                      setAnswers((current) =>
                        current.map((value, i) => (i === index ? answer : value)),
                      )
                    }
                  />
                  {t(answer === 'unsure' ? 'unsure' : `options.${question}.${answer}`)}
                </label>
              ))}
            </fieldset>
          ))}
          <div className="hero-actions">
            <Button type="submit" disabled={busy}>
              {t(busy ? 'loading' : 'rank')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              {t('editBirth')}
            </Button>
          </div>
        </form>
      )}
      {busy ? <p role="status">{t('loading')}</p> : null}
    </section>
  );
}
// DESIGN-GAP: Owner actions add version/name metadata; the strict input boundary accepts birth fields only.
function initialBirth(input: BirthInput): BirthInput {
  const {
    calendar,
    year,
    month,
    day,
    isLeapMonth,
    hour,
    minute,
    timeUnknown,
    place,
    gender,
    timeSource,
    rectificationConfidence,
  } = input;
  return {
    calendar,
    year,
    month,
    day,
    isLeapMonth,
    hour,
    minute,
    timeUnknown,
    place,
    gender,
    timeSource,
    rectificationConfidence,
  };
}
