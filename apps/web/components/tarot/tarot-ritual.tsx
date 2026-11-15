'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { computeTarot } from '@tianji/engine/tarot';
import { interpret, localizeReport } from '@tianji/interpret';
import type { KnowledgeBundle } from '@tianji/content';
import { TAROT_SPREADS, type Locale, type TarotChart } from '@tianji/shared';
import { useRouter } from '@/i18n/navigation';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import { TarotDraftSchema, ritualDeck, type TarotDraft } from '@/lib/tarot';
import { createReadingAction } from '@/app/readings/actions';
import { ensureConsent } from '@/lib/consent';
import type { LocalReading, ReadingRequest } from '@/lib/reading-schema';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TarotShuffle } from './tarot-shuffle';
import { TarotCut } from './tarot-cut';
import { TarotFan } from './tarot-fan';
import { ReportLayout } from '@/components/report/report-layout';
import { SpreadLayout } from './spread-layout';
import { removePosition, togglePick, type TarotEntry } from './ritual-state';
type Step = 'shuffle' | 'cut' | 'pick' | 'reveal';
/** Complete deterministic ritual; bundled bilingual knowledge allows anonymous draw/report generation offline. */
export function TarotRitual({
  knowledge,
  engineVersion,
  signedIn,
  entry = null,
}: {
  knowledge: KnowledgeBundle;
  engineVersion: string;
  signedIn: boolean;
  /** Direct entry from `?spread=&q=` (e.g. the bottom "ask" sheet); replaces any stored draft. */
  entry?: TarotEntry | null;
}) {
  const t = useTranslations('tarot');
  const intl = useTranslations();
  const languageLabel = intl('nav.language');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [draft, setDraft] = useState<TarotDraft | null>(null);
  const [step, setStep] = useState<Step>('shuffle');
  const [shuffles, setShuffles] = useState(0);
  const [cut, setCut] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [chart, setChart] = useState<TarotChart | null>(null);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [localResult, setLocalResult] = useState<LocalReading | null>(null);
  const lock = useRef(false);
  const exitHref = useRef<string | null>(null);
  const confirmedExit = useRef(false);
  const requestId = useRef<string | null>(null);
  const entrySpread = entry?.spread;
  const entryQuestion = entry?.question ?? '';
  const deck = useMemo(() => ritualDeck(shuffles, cut), [shuffles, cut]);
  useEffect(() => {
    let active = true;
    const load = async (): Promise<TarotDraft | null> => {
      if (!entrySpread) {
        const data = await readAnonymous();
        const parsed = TarotDraftSchema.safeParse(data?.settings.tarotDraft);
        return parsed.success ? parsed.data : null;
      }
      // Same age/disclaimer gate the selection form applies before storing a draft.
      if (!(await ensureConsent())) return null;
      const next: TarotDraft = {
        spread: entrySpread,
        question: entryQuestion,
        category: 'general',
        allowReversed: true,
        seed: crypto.randomUUID(),
      };
      // Persist so a reload keeps the question after it is stripped from the address bar.
      await updateAnonymous((data) => ({
        ...data,
        settings: { ...data.settings, tarotDraft: next },
      })).catch(() => undefined);
      window.history.replaceState(window.history.state, '', window.location.pathname);
      return next;
    };
    void load()
      .then((loaded) => {
        if (!active) return;
        if (!loaded) {
          router.replace('/tarot');
          return;
        }
        setDraft(loaded);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(true);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [router, entrySpread, entryQuestion]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!confirmedExit.current) event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest('a');
      if (anchor && !anchor.href.includes('#') && !anchor.hasAttribute('download')) {
        event.preventDefault();
        event.stopPropagation();
        exitHref.current = anchor.href;
        setLeave(true);
      }
    };
    const changeLocale = (event: Event) => {
      const select = event.target;
      if (
        select instanceof HTMLSelectElement &&
        select.getAttribute('aria-label') === languageLabel &&
        (select.value === 'zh' || select.value === 'zh-TW' || select.value === 'en') &&
        select.value !== locale
      ) {
        exitHref.current = window.location.href.replace(`/${locale}/`, `/${select.value}/`);
        select.value = locale;
        event.preventDefault();
        event.stopPropagation();
        setLeave(true);
      }
    };
    if (ready && !localResult) {
      window.addEventListener('beforeunload', unload);
      document.addEventListener('click', navigate, true);
      document.addEventListener('change', changeLocale, true);
    }
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
      document.removeEventListener('change', changeLocale, true);
    };
  }, [ready, localResult, locale, languageLabel]);
  const draw = (indices: number[]) => {
    if (!draft) return;
    const result = computeTarot({ ...draft, pickedIndices: indices });
    setPicked(indices);
    setChart(result);
    setStep('reveal');
  };
  // DESIGN-GAP: A full spread waits for an explicit "start revealing" so the last pick can still be undone.
  const pick = (index: number) => {
    if (draft)
      setPicked((current) => togglePick(current, index, TAROT_SPREADS[draft.spread].length));
  };
  const auto = () => {
    if (!draft) return;
    // DESIGN-GAP: “Draw for me” completes any remaining positions from the current visible deck order, guaranteeing repeatability and no duplicates.
    setShuffles((n) => Math.max(1, n));
    const automaticDeck = shuffles === 0 ? ritualDeck(1, cut) : deck;
    draw([
      ...picked,
      ...automaticDeck
        .filter((i) => !picked.includes(i))
        .slice(0, TAROT_SPREADS[draft.spread].length - picked.length),
    ]);
  };
  const complete = async () => {
    if (!draft || !chart || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    const idempotencyKey = requestId.current ?? crypto.randomUUID();
    requestId.current = idempotencyKey;
    const request: ReadingRequest = {
      system: 'tarot',
      locale,
      question: draft.question,
      category: draft.category,
      spread: draft.spread,
      seed: draft.seed,
      allowReversed: draft.allowReversed,
      pickedIndices: picked,
      idempotencyKey,
    };
    try {
      if (signedIn) {
        const result = await createReadingAction(request);
        if (!result.ok) throw new Error(result.error.code);
        if ('readingId' in result.data && result.data.readingId) {
          router.push(`/tarot/r/${result.data.readingId}`);
          return;
        }
      }
      const createdAt = new Date().toISOString();
      const reportZh = interpret({
        system: 'tarot',
        chart,
        locale: 'zh',
        knowledge,
        context: { now: createdAt, profileHasTime: true, engineVersion },
      });
      const reportEn = interpret({
        system: 'tarot',
        chart,
        locale: 'en',
        knowledge,
        context: { now: createdAt, profileHasTime: true, engineVersion },
      });
      const local: LocalReading = {
        id: idempotencyKey,
        system: 'tarot',
        createdAt,
        title: null,
        chart,
        report: locale === 'en' ? reportEn : localizeReport(reportZh, locale),
        reportZh,
        reportEn,
        meta: { schoolUsed: { deck: 'rws', allowReversed: draft.allowReversed }, warnings: [] },
        request,
      };
      await updateAnonymous((data) => ({
        ...data,
        readings: [...data.readings.filter((r) => r.id !== local.id).slice(-49), local],
      }));
      // DESIGN-GAP: Offline navigation cannot fetch an unvisited Next.js route chunk; render the saved report here until connectivity returns.
      if (!navigator.onLine) setLocalResult(local);
      else router.push(`/tarot/r/local/${local.id}`);
    } catch {
      setError(true);
      setBusy(false);
      lock.current = false;
    }
  };
  if (localResult) return <ReportLayout reading={localResult} local />;
  if (!ready)
    return (
      <div className="status-page" role="status">
        {t('saving')}
      </div>
    );
  if (!draft)
    return (
      <div className="status-page" role="alert">
        {t('error')}
        <Button onClick={() => router.replace('/tarot')}>{t('retry')}</Button>
      </div>
    );
  const count = TAROT_SPREADS[draft.spread].length;
  return (
    <section className="tarot-page">
      <header>
        <p className="eyebrow">{t(`spread.${draft.spread}.name`)}</p>
        <h1 className="type-h1">{t(step)}</h1>
        <ol className="tarot-steps">
          {(['shuffle', 'cut', 'pick', 'reveal'] as const).map((key) => (
            <li key={key} aria-current={key === step ? 'step' : undefined}>
              {t(key)}
            </li>
          ))}
        </ol>
      </header>
      <div className="hero-actions">
        <Button
          variant="ghost"
          onClick={() => {
            exitHref.current = null;
            setLeave(true);
          }}
        >
          {t('exit')}
        </Button>
      </div>
      <MotionConfig
        reducedMotion={
          typeof window !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true'
            ? 'always'
            : 'user'
        }
      >
        <LayoutGroup>
          {step === 'shuffle' ? (
            <>
              <TarotShuffle count={shuffles} onShuffle={() => setShuffles((n) => n + 1)} />
              <div className="hero-actions">
                <Button disabled={shuffles === 0} onClick={() => setStep('cut')}>
                  {t('next')}
                </Button>
                <Button variant="secondary" onClick={auto}>
                  {t('auto')}
                </Button>
              </div>
            </>
          ) : null}
          {step === 'cut' ? (
            <>
              <TarotCut
                onDone={(order) => {
                  setCut(order);
                  setStep('pick');
                }}
              />
              <Button variant="secondary" onClick={auto}>
                {t('auto')}
              </Button>
            </>
          ) : null}
          {step === 'pick' ? (
            <>
              <p role="status">{t('pickCount', { count: picked.length, total: count })}</p>
              <TarotFan deck={deck} picked={picked} onPick={pick} />
              {picked.length > 0 ? <p className="muted">{t('pickUndoHelp')}</p> : null}
              <div className="hero-actions tarot-primary-actions">
                {picked.length === count ? (
                  <Button onClick={() => draw(picked)}>{t('startReveal')}</Button>
                ) : (
                  <Button onClick={auto}>{t('auto')}</Button>
                )}
              </div>
            </>
          ) : null}
          {step === 'pick' || step === 'reveal' ? (
            <SpreadLayout
              spread={draft.spread}
              cards={chart?.cards}
              picked={picked}
              revealed={revealed}
              onRemove={
                step === 'pick'
                  ? (order) => setPicked((current) => removePosition(current, order))
                  : undefined
              }
              onReveal={
                step === 'reveal'
                  ? (order) =>
                      setRevealed((current) =>
                        current.includes(order) ? current : [...current, order],
                      )
                  : undefined
              }
            />
          ) : null}
        </LayoutGroup>
      </MotionConfig>
      {step === 'reveal' ? (
        <>
          <p id="tarot-reveal-status">
            {revealed.length === count
              ? t('revealDone')
              : t('revealPending', { count: count - revealed.length })}
          </p>
          <div className="hero-actions tarot-primary-actions">
            {revealed.length === count ? null : (
              <Button
                variant="secondary"
                onClick={() => setRevealed(Array.from({ length: count }, (_, i) => i))}
              >
                {t('revealAll')}
              </Button>
            )}
            <Button
              variant={revealed.length === count ? 'default' : 'secondary'}
              disabled={revealed.length !== count || busy}
              aria-describedby="tarot-reveal-status"
              action={complete}
            >
              {t(busy ? 'saving' : 'result')}
            </Button>
          </div>
        </>
      ) : null}
      {error ? <p role="alert">{t('error')}</p> : null}
      <Dialog
        open={leave}
        onOpenChange={setLeave}
        title={t('exitTitle')}
        description={t('exitBody')}
      >
        <div className="hero-actions">
          <Button variant="secondary" onClick={() => setLeave(false)}>
            {t('stay')}
          </Button>
          <Button
            onClick={() => {
              confirmedExit.current = true;
              if (exitHref.current) window.location.assign(exitHref.current);
              else router.push('/tarot');
            }}
          >
            {t('exitConfirm')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
