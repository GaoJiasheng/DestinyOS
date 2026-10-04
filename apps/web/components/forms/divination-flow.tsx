'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { interpret } from '@tianji/interpret';
import { ENGINE_VERSION } from '@tianji/engine';
import { Solar } from 'lunar-typescript';
import {
  IchingCategorySchema,
  QimenCategorySchema,
  type IchingChart,
  type QimenChart,
} from '@tianji/shared';
import type { KnowledgeBundle } from '@tianji/content';
import { createReadingAction } from '@/app/readings/actions';
import { useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { castClock, computeDivination, computeDivinationResult } from '@/lib/divination';
import { updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading, ReadingRequest } from '@/lib/reading-schema';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { CoinToss } from '@/components/charts/coin-toss';
import { ReportLayout } from '@/components/report/report-layout';
import { DivinationChart } from '@/components/charts/divination-chart';
import { NumberPad } from './number-pad';
export type CastMethod = 'time' | 'numbers' | 'random' | 'liuyao';
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Complete birth-independent casting ritual, preserving the clock/seed across retries and all coin throws. */
export function DivinationFlow({
  system,
  method = 'time',
  knowledge,
  signedIn,
}: {
  system: 'iching' | 'qimen';
  method?: CastMethod;
  knowledge: KnowledgeBundle;
  signedIn: boolean;
}) {
  const t = useTranslations('divination');
  const copy = useCopy();
  const locale = useLocale() as 'zh' | 'en';
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState(system === 'iching' ? 'other' : 'general');
  const [local, setLocal] = useState('');
  const [tz, setTz] = useState('UTC');
  const [numbers, setNumbers] = useState(['', '', '']);
  const [step, setStep] = useState<'question' | 'ritual' | 'generating'>('question');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<IchingChart | QimenChart | null>(null);
  const [throwsDone, setThrowsDone] = useState(0);
  const [coinCount, setCoinCount] = useState(0);
  const [tossRound, setTossRound] = useState(0);
  const [offlineReading, setOfflineReading] = useState<LocalReading | null>(null);
  const [fast, setFast] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exitHref, setExitHref] = useState(`/${locale}`);
  const lock = useRef(false);
  const active = useRef(true);
  const snapshot = useRef<{ req: ReadingRequest; chart: IchingChart | QimenChart } | null>(null);
  const completed = useRef(false);
  const [reduced, setReduced] = useState(false);
  const now = () => {
    const date = new Date();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setTz(zone);
    setLocal(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    );
    snapshot.current = null;
  };
  useEffect(() => {
    active.current = true;
    now();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener('change', change);
    return () => {
      active.current = false;
      media.removeEventListener('change', change);
    };
  }, []);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!completed.current && (question || step !== 'question' || system === 'qimen')) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (
        anchor &&
        anchor.origin === location.origin &&
        !completed.current &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        setExitHref(anchor.href);
        setLeaving(true);
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
    };
  }, [question, step, system]);
  const prepare = () => {
    if (snapshot.current) return snapshot.current;
    const at = castClock(local, tz);
    const validNumbers = numbers.slice(0, numbers[2] ? 3 : 2).map(Number);
    if (
      system === 'iching' &&
      method === 'numbers' &&
      (validNumbers.length < 2 || validNumbers.some((n) => n < 1 || n > 999))
    )
      throw new Error('numbers');
    // DESIGN-GAP: 07's question record transports the civil clock and method-specific input; question text stays out of URLs.
    const req: ReadingRequest = {
      system,
      locale,
      category,
      idempotencyKey: crypto.randomUUID(),
      seed: crypto.randomUUID(),
      question: {
        text: question,
        ...(system === 'qimen' || method === 'liuyao'
          ? { at }
          : {
              meihua: {
                castBy: method,
                at,
                ...(method === 'numbers' ? { numbers: validNumbers } : {}),
              },
            }),
      },
      ...(system === 'iching'
        ? { method: method === 'liuyao' ? 'liuyao' : 'meihua' }
        : {
            options: {
              school: {
                layout: 'rotating',
                juMethod: 'chaibu',
                centerLodge: 'kun2',
                useApparentSolarTime: false,
              },
            },
          }),
    };
    const next = { req, chart: computeDivination(req) };
    snapshot.current = next;
    return next;
  };
  const submit = async (prepared: NonNullable<typeof snapshot.current>) => {
    setStep('generating');
    setChart(prepared.chart);
    const began = performance.now();
    let data:
      | { readingId?: string }
      | Omit<LocalReading, 'id' | 'system' | 'createdAt' | 'title' | 'request'>;
    let offline = false;
    try {
      if (!navigator.onLine && !signedIn) throw new Error('offline');
      const result = await createReadingAction(prepared.req);
      if (!result.ok) {
        setError(`report.error.${result.error.code}`);
        setStep(system === 'qimen' ? 'question' : 'ritual');
        return;
      }
      data = result.data;
    } catch {
      if (signedIn) {
        setError('report.error.E_INTERNAL');
        setStep(system === 'qimen' ? 'question' : 'ritual');
        return;
      }
      // DESIGN-GAP: Use the validated bundled knowledge for anonymous network failures; signed-in persistence never silently falls back.
      offline = true;
      data = {
        chart: prepared.chart,
        report: interpret({
          system,
          chart: prepared.chart,
          locale,
          knowledge,
          context: {
            now: new Date().toISOString(),
            profileHasTime: true,
            engineVersion: ENGINE_VERSION,
          },
        }),
        meta: computeDivinationResult(prepared.req).meta,
      };
    }
    await pause(Math.max(0, (reduced ? 150 : 1800) - (performance.now() - began)));
    if (!active.current) return;
    if ('readingId' in data && data.readingId) {
      completed.current = true;
      router.push(`/${system}/r/${data.readingId}`);
      return;
    }
    if (!('report' in data)) throw new Error('invalid response');
    const id = crypto.randomUUID();
    const reading: LocalReading = {
      ...data,
      id,
      system,
      createdAt: new Date().toISOString(),
      title: null,
      request: prepared.req,
    };
    await updateAnonymous((d) => ({ ...d, readings: [reading, ...d.readings].slice(0, 50) }));
    completed.current = true;
    if (offline) {
      // DESIGN-GAP: Native history keeps the documented local result URL usable without fetching a new RSC route offline.
      window.history.replaceState(null, '', `/${locale}/${system}/r/local/${id}`);
      setOfflineReading(reading);
    } else router.push(`/${system}/r/local/${id}`);
  };
  const cast = async (all = false) => {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    setBusy(true);
    setFast(all);
    try {
      const prepared = prepare();
      if (method === 'liuyao' && 'liuyao' in prepared.chart && prepared.chart.liuyao) {
        const target = all ? 6 : Math.min(6, throwsDone + 1);
        for (let i = throwsDone; i < target; i++) {
          setCoinCount(prepared.chart.liuyao.throws[i]!);
          setTossRound(i + 1);
          await pause(reduced ? 150 : all ? 400 : 1200);
          if (!active.current) return;
          setThrowsDone(i + 1);
        }
        if (target < 6) return;
      } else if (method === 'random' && system === 'iching') {
        // DESIGN-GAP: Random Meihua's decorative coins show the first seeded source number modulo four.
        if ('meihua' in prepared.chart)
          setCoinCount((prepared.chart.meihua?.numbers.source[0] ?? 0) % 4);
        setTossRound(1);
        await pause(reduced ? 150 : 1200);
      }
      await submit(prepared);
    } catch {
      setError(
        snapshot.current
          ? 'report.storageError'
          : method === 'numbers'
            ? 'divination.invalidNumbers'
            : 'divination.invalidClock',
      );
      setStep(system === 'qimen' ? 'question' : 'ritual');
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  };
  const lunar = (() => {
    if (!local) return null;
    try {
      const [date, time] = local.split('T');
      const [y, m, d] = date!.split('-').map(Number);
      const [h, min] = time!.split(':').map(Number);
      const l = Solar.fromYmdHms(y!, m!, d!, h!, min!, 0).getLunar();
      return t('lunarClock', {
        year: l.getYear(),
        month: Math.abs(l.getMonth()),
        day: l.getDay(),
        hour: h!,
        leap: l.getMonth() < 0 ? t('leap') : '',
      });
    } catch {
      return null;
    }
  })();
  const categories =
    system === 'iching' ? IchingCategorySchema.options : QimenCategorySchema.options;
  if (offlineReading) return <ReportLayout reading={offlineReading} local />;
  return (
    <section className="birth-shell divination-shell">
      <p className="eyebrow">
        {copy(`nav.${system}`)} · {t(system === 'qimen' ? 'school' : `methods.${method}`)}
      </p>
      <h1 className="type-h1">{t(system === 'qimen' ? 'qimenTitle' : 'ichingTitle')}</h1>
      {step === 'generating' && chart ? (
        <div className="birth-card" role="status" aria-live="polite">
          <h2>{t('generating')}</h2>
          <DivinationChart chart={chart} animate={!reduced} />
        </div>
      ) : (
        <form
          className="birth-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (system === 'iching' && step === 'question') setStep('ritual');
            else void cast();
          }}
        >
          <fieldset className="cast-fields" disabled={busy || !local}>
            {step === 'question' ? (
              <>
                <label className="birth-field">
                  {t('question')}
                  <textarea
                    maxLength={120}
                    placeholder={t('questionPlaceholder')}
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      snapshot.current = null;
                    }}
                  />
                </label>
                <p className="muted">{t('questionOptional')}</p>
                <fieldset disabled={busy}>
                  <legend>{t('category')}</legend>
                  <div className="category-chips">
                    {categories.map((c) => (
                      <Button
                        type="button"
                        key={c}
                        variant={c === category ? 'default' : 'secondary'}
                        aria-pressed={c === category}
                        onClick={() => {
                          setCategory(c);
                          snapshot.current = null;
                        }}
                      >
                        {t(`categories.${c}`)}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}
            {system === 'qimen' || (step === 'ritual' && method === 'time') ? (
              <>
                <label className="birth-field">
                  {t('castAt')}
                  <input
                    type="datetime-local"
                    required
                    min="1900-01-01T00:00"
                    max="2100-12-31T23:59"
                    disabled={busy}
                    value={local}
                    onChange={(e) => {
                      setLocal(e.target.value);
                      snapshot.current = null;
                    }}
                  />
                </label>
                <label className="birth-field">
                  {t('timezone')}
                  <input
                    required
                    list="cast-timezones"
                    disabled={busy}
                    value={tz}
                    onChange={(e) => {
                      setTz(e.target.value);
                      snapshot.current = null;
                    }}
                  />
                </label>
                <datalist id="cast-timezones">
                  {Intl.supportedValuesOf('timeZone').map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
                <Button type="button" variant="secondary" disabled={busy} onClick={now}>
                  {t('now')}
                </Button>
                {system === 'iching' && lunar ? <p className="notice">{lunar}</p> : null}
              </>
            ) : null}
            {step === 'ritual' && method === 'numbers' ? (
              <NumberPad
                values={numbers}
                onChange={(v) => {
                  setNumbers(v);
                  snapshot.current = null;
                }}
              />
            ) : null}
            {step === 'ritual' && (method === 'liuyao' || method === 'random') ? (
              <>
                <CoinToss count={coinCount} tossing={busy} fast={fast} round={tossRound} />
                {method === 'liuyao' ? (
                  <>
                    <p role="status" aria-live="polite">
                      {t('throwProgress', { count: throwsDone })}
                    </p>
                    <div className="throw-preview">
                      {snapshot.current && 'liuyao' in snapshot.current.chart
                        ? snapshot.current.chart.liuyao?.throws.slice(0, throwsDone).map((v, i) => (
                            <p key={i}>
                              {t('lineLabel', {
                                position: i + 1,
                                type: t(v % 2 ? 'yang' : 'yin'),
                                moving: t(v === 0 || v === 3 ? 'moving' : 'static'),
                              })}
                            </p>
                          ))
                        : null}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
            {error ? (
              <p role="alert" className="form-error">
                {copy(error as MessageKey)}
              </p>
            ) : null}
            <div className="hero-actions">
              <Button type="submit" disabled={busy || !local}>
                {t(
                  busy
                    ? 'working'
                    : system === 'qimen'
                      ? 'castQimen'
                      : step === 'question'
                        ? 'continue'
                        : method === 'time'
                          ? 'castTime'
                          : method === 'random'
                            ? 'toss'
                            : method === 'liuyao'
                              ? throwsDone === 6
                                ? 'retry'
                                : 'shake'
                              : 'castNumbers',
                )}
              </Button>
              {step === 'ritual' && method === 'liuyao' && throwsDone < 6 ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void cast(true)}
                >
                  {t('shakeAll')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setExitHref(system === 'iching' ? `/${locale}/iching` : `/${locale}`);
                  setLeaving(true);
                }}
              >
                {t('exit')}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      <p className="muted">{copy(signedIn ? 'report.disclaimer.short' : 'report.localNotice')}</p>
      <Dialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t('exitTitle')}
        description={t('exitBody')}
      >
        <div className="hero-actions">
          <Button variant="secondary" onClick={() => setLeaving(false)}>
            {t('stay')}
          </Button>
          <Button
            onClick={() => {
              completed.current = true;
              window.location.assign(exitHref);
            }}
          >
            {t('leave')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
