'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Temporal } from '@js-temporal/polyfill';
import { type BirthInput, type Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getDailyAction, recordAnonymousDailyViewAction } from '@/app/today/actions';
import { submitFeedbackAction } from '@/app/readings/actions';
import { readAnonymous } from '@/lib/anonymous-storage';
import { localToday } from '@/lib/daily-date';
import type { DailyReport } from '@/lib/daily-compute';
import { calculateDailyInWorker } from '@/lib/daily-worker';
import { dailyExcerpt } from '@/lib/daily-excerpt';
import { ShareDialog } from '@/components/share/share-dialog';
import { JournalForm } from '@/components/me/journal-form';
import { AdSlot } from '@/components/report/report-section';
const demo: BirthInput = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
  place: { name: 'Example', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
};
/** Thirteen daily blocks, local anonymous computation, bounded date controls and touch navigation. */
// DESIGN-GAP: 未规定的五要素历中文名采用月日/瑜伽序号、半日类型号与中文星期；星宿复用已有 glossary 译名。
export function TodayView({
  signedIn,
  profileId,
  tz,
  plan,
  vedicUsed,
  panchangDefaultOpen = false,
}: {
  signedIn: boolean;
  profileId?: string;
  tz?: string | null;
  plan: 'free' | 'pro';
  vedicUsed: boolean;
  panchangDefaultOpen?: boolean;
}) {
  const requestedDate = useSearchParams().get('date');
  const t = useCopy(),
    intl = useTranslations(),
    locale = useLocale() as Locale;
  // DESIGN-GAP: Panchang expansion is a device preference because the documented User schema has no field for it.
  const [offset, setOffset] = useState(0),
    [zone, setZone] = useState<string | null>(tz ?? null),
    [value, setValue] = useState<DailyReport | null>(null),
    [example, setExample] = useState(false),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(true),
    [retry, setRetry] = useState(0),
    [panchang, setPanchang] = useState(vedicUsed || panchangDefaultOpen),
    [flipped, setFlipped] = useState(false),
    [vote, setVote] = useState<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem('tianji-tz');
    setZone(tz ?? saved ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    const pref = localStorage.getItem('tianji-panchang');
    if (pref !== null) setPanchang(pref === 'true');
  }, [tz]);
  useEffect(() => {
    if (!zone) return;
    document.cookie = `tz=${encodeURIComponent(zone)}; Path=/; SameSite=Lax`;
    let active = true;
    const controller = new AbortController();
    setBusy(true);
    setError(false);
    setFlipped(false);
    setVote(null);
    void (async () => {
      const date = Temporal.PlainDate.from(requestedDate ?? localToday(zone))
        .add({ days: offset })
        .toString();
      if (signedIn) {
        const result = await getDailyAction({ date, tz: zone, locale, profileId });
        if (result.ok) {
          if (active) {
            setValue(result.data);
            setExample(false);
          }
          window.dispatchEvent(new CustomEvent('tianji:event', { detail: { name: 'daily.view' } }));
          return;
        }
        if (result.error.code !== 'E_PROFILE_REQUIRED') throw new Error(result.error.code);
      }
      const device = signedIn ? Promise.resolve(null) : readAnonymous();
      const input = device.then(async (data) => {
        const hash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${data?.anonId ?? 'example'}|${date}`),
        );
        const seed = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join(
          '',
        );
        return { profile: data?.profile ?? demo, date, tz: zone, seed, locale };
      });
      const computed = await calculateDailyInWorker(input, controller.signal, locale);
      const data = await device;
      if (active) {
        setValue(computed);
        setExample(!data?.profile);
        window.dispatchEvent(new CustomEvent('tianji:event', { detail: { name: 'daily.view' } }));
        if (
          localStorage.getItem('tianji-panchang') === null &&
          data?.readings.some((r) => r.system === 'vedic')
        )
          setPanchang(true);
      }
    })()
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [signedIn, profileId, zone, offset, locale, retry, requestedDate]);
  useEffect(() => {
    if (signedIn || !value) return;
    // DESIGN-GAP: Record anonymous visit dimensions after the first result paint; telemetry's RSC response must not delay the locally computed content.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void recordAnonymousDailyViewAction(locale).catch(() => undefined);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [signedIn, value, locale]);
  const chart = value?.chart,
    report = value?.report,
    vedic = value?.chart.vedic;
  const content = (key: string) => {
    const s = report?.sections.find((s) => s.key === key);
    return s?.blocks
      .filter((b) => b.type === 'paragraph')
      .slice(0, 1)
      .map((b, i) =>
        b.type === 'paragraph' ? (
          <p key={i}>
            {t('report.content', {
              text: dailyExcerpt(b.text, locale, (key) => intl(`glossary.${key}.term`)),
            })}
          </p>
        ) : null,
      );
  };
  const title = (key: string) => intl(`report.sections.daily.${key}`);
  const stars = (score: number) =>
    score >= 85 ? 5 : score >= 70 ? 4 : score >= 55 ? 3 : score >= 40 ? 2 : 1;
  function switchDate(n: number) {
    window.dispatchEvent(
      new CustomEvent('tianji:event', { detail: { name: 'daily.date.switch' } }),
    );
    setOffset(requestedDate ? n : Math.max(-1, Math.min(1, n)));
  }
  return (
    <article
      className="daily-page"
      onTouchStart={(e) => {
        // DESIGN-GAP: Editing journal inputs must not trigger date swipes and discard an unsaved sentence.
        if (e.target instanceof Element && e.target.closest('[data-journal-form]')) {
          touch.current = null;
          return;
        }
        const p = e.touches[0];
        if (p) touch.current = { x: p.clientX, y: p.clientY };
      }}
      onTouchEnd={(e) => {
        const p = e.changedTouches[0],
          start = touch.current;
        if (p && start && Math.abs(p.clientX - start.x) > 60 && Math.abs(p.clientY - start.y) < 50)
          switchDate(offset + (p.clientX < start.x ? 1 : -1));
        touch.current = null;
      }}
    >
      <header data-daily-block="1">
        <h1 className="type-h1">{t('nav.today')}</h1>
        <Link href="/today/calendar" className="text-link">
          {t('calendar.title')}
        </Link>
        <nav className="action-row" aria-label={t('daily.dateNav')}>
          <Button
            variant="ghost"
            disabled={!requestedDate && offset === -1}
            onClick={() => switchDate(offset - 1)}
          >
            {t('daily.yesterday')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (requestedDate) window.location.assign(`/${locale}/today`);
              else switchDate(0);
            }}
          >
            {t('daily.today')}
          </Button>
          <Button
            variant="ghost"
            disabled={!requestedDate && offset === 1}
            onClick={() => switchDate(offset + 1)}
          >
            {t('daily.tomorrow')}
          </Button>
        </nav>
        {chart ? (
          <>
            <time dateTime={chart.date.local}>
              {new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
                new Date(`${chart.date.local}T12:00:00Z`),
              )}
            </time>
            <p>
              {t('daily.lunar', {
                year: chart.date.lunar.year,
                month: chart.date.lunar.month,
                day: chart.date.lunar.day,
              })}
            </p>
            <p>
              {Object.values(chart.date.ganZhi)
                .map((g) => `${intl(`bazi.stems.${g.stem}`)}${intl(`bazi.branches.${g.branch}`)}`)
                .join(' · ')}{' '}
              ·{' '}
              <span aria-hidden>
                {
                  (
                    {
                      new_moon: '🌑',
                      waxing_crescent: '🌒',
                      first_quarter: '🌓',
                      waxing_gibbous: '🌔',
                      full_moon: '🌕',
                      waning_gibbous: '🌖',
                      last_quarter: '🌗',
                      waning_crescent: '🌘',
                    } as Record<string, string>
                  )[chart.astro.moonPhase.name]
                }
              </span>{' '}
              {intl(`daily.moonPhase.${chart.astro.moonPhase.name}`)}
            </p>
            {chart.date.solarTerm ? <p>{intl(`home.term.${chart.date.solarTerm.name}`)}</p> : null}
          </>
        ) : null}
      </header>
      {busy ? <p role="status">{t('common.loading')}</p> : null}
      {error ? (
        <div role="alert">
          {t('report.error.E_INTERNAL')}
          <Button onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</Button>
        </div>
      ) : null}
      {value && chart && report ? (
        <div className="daily-body" aria-busy={busy}>
          {example ? (
            <div className="daily-example-overlay">
              <p>{t('daily.example')}</p>
              <Link href="/me/birth" className="text-link">
                {t('daily.profileCTA')}
              </Link>
            </div>
          ) : null}
          <div className={example ? 'daily-example-blur' : ''} inert={example || undefined}>
            <section className="report-card" data-daily-block="2">
              <h2>{t('daily.oneLiner.label')}</h2>
              <p className="type-h2">{t('report.content', { text: intl(chart.oneLiner) })}</p>
              {chart.numerology ? (
                <p data-personal-day>
                  {t('daily.personalDay', { number: chart.numerology.personalDay })}
                </p>
              ) : null}
            </section>
            <section className="report-card" data-daily-block="3">
              <h2>{t('daily.ratings')}</h2>
              <div
                className={`daily-overall band-${chart.scores.overall >= 70 ? 'good' : 'mixed'}`}
                role="img"
                aria-label={`${t('daily.overall')} · ${t(`daily.rating.${stars(chart.scores.overall)}` as MessageKey)}`}
              >
                <span aria-hidden>
                  {t(`daily.rating.${stars(chart.scores.overall)}` as MessageKey)}
                </span>
              </div>
              <div className="daily-grid">
                {(['career', 'wealth', 'love', 'health', 'social'] as const).map((k) => (
                  <div key={k}>
                    <h3>{t(`daily.dimension.${k}`)}</h3>
                    <p aria-label={t('daily.stars', { count: stars(chart.scores[k]) })}>
                      {'★'.repeat(stars(chart.scores[k]))}
                      {'☆'.repeat(5 - stars(chart.scores[k]))}
                    </p>
                    <p>{t(`daily.rating.${stars(chart.scores[k])}` as MessageKey)}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="report-card" data-daily-block="4">
              <h2>{t('daily.lucky')}</h2>
              <div className="daily-grid">
                <p>
                  <span className="color-dot" style={{ background: chart.bazi.luckyColorHex }} />
                  {t('daily.lucky.color')} · {intl(chart.bazi.luckyColor[0]!)}
                </p>
                <p>
                  {t('daily.lucky.number')} · {chart.bazi.luckyNumbers.join(' / ')}
                </p>
                <p>
                  {t('daily.lucky.direction')} · {intl(chart.bazi.luckyDirection)}
                </p>
                <p>
                  {t('daily.lucky.hours')} ·{' '}
                  {chart.bazi.goodHours.map((h) => `${h.from}–${h.to}`).join(' / ')}
                </p>
                <p>
                  {t('daily.lucky.zodiac')} ·{' '}
                  {chart.bazi.nobleZodiac.map((b) => intl(`daily.zodiac.${b}`)).join(' / ')}
                </p>
              </div>
            </section>
            <section className="report-card" data-daily-block="5">
              <h2>{t('daily.almanac')}</h2>
              <div className="daily-grid">
                {(['yi', 'ji'] as const).map((k) => (
                  <div key={k}>
                    <h3>{t(`daily.${k}`)}</h3>
                    <ul>
                      {chart.bazi.almanac[k].map((v) => (
                        <li key={v}>{intl(v)}</li>
                      ))}
                    </ul>
                    {!chart.bazi.almanac[k].length ? <p>{t('daily.almanacEmpty')}</p> : null}
                  </div>
                ))}
              </div>
            </section>
            <section className="report-card" data-daily-block="6">
              {['career', 'wealth', 'love', 'health'].map((k) => (
                <div key={k}>
                  <h2>{title(k)}</h2>
                  {content(k)}
                </div>
              ))}
            </section>
            <div data-daily-block="13">
              <AdSlot slot="today" plan={plan} />
            </div>
            <section className="report-card" data-daily-block="7">
              <h2>{title('astro')}</h2>
              <p>
                {intl(`charts.sign.${chart.astro.moonSign}`)} ·{' '}
                {intl(`daily.moonPhase.${chart.astro.moonPhase.name}`)}
              </p>
              {content('astro')}
              {chart.astro.transits.slice(0, 2).map((v, i) => (
                <p key={i}>
                  {intl(`charts.planet.${v.transiting}`)} · {intl(`charts.aspect.${v.aspect}`)} ·{' '}
                  {intl(
                    `${v.natal === 'asc' || v.natal === 'mc' ? 'charts.angle' : 'charts.planet'}.${v.natal}`,
                  )}
                </p>
              ))}
            </section>
            <section className="report-card" data-daily-block="8">
              <h2>{title('tarot')}</h2>
              <Button aria-pressed={flipped} onClick={() => setFlipped((v) => !v)}>
                {t(flipped ? 'daily.cardHide' : 'daily.cardFlip')}
              </Button>
              {flipped ? (
                <div className="daily-card-face">
                  <img
                    width="160"
                    height="267"
                    src={`/tarot/rws/${chart.tarot.card}.webp`}
                    alt={intl(`tarot.card.${chart.tarot.card}.name`)}
                  />
                  <h3>
                    {intl(`tarot.card.${chart.tarot.card}.name`)} ·{' '}
                    {intl(`tarot.${chart.tarot.reversed ? 'reversed' : 'upright'}`)}
                  </h3>
                  {content('tarot')}
                  <Link href={`/learn/tarot/${chart.tarot.card}`}>{t('daily.cardLearn')}</Link>
                </div>
              ) : null}
            </section>
            <section className="report-card" data-daily-block="9">
              <details open={panchang} onToggle={(e) => setPanchang(e.currentTarget.open)}>
                <summary>{title('panchang')}</summary>
                {vedic ? (
                  <dl className="daily-grid">
                    {(['tithi', 'nakshatra', 'yoga', 'karana', 'vara'] as const).map((k) => (
                      <div key={k}>
                        <dt>{t(`daily.panchang.${k}`)}</dt>
                        <dd>
                          {t('report.content', {
                            text: intl.has(`charts.panchang.${k}.${vedic[k].key}`)
                              ? intl(`charts.panchang.${k}.${vedic[k].key}`)
                              : t('daily.panchang.value', {
                                  index: vedic[k].index,
                                  time: new Intl.DateTimeFormat(locale, {
                                    timeStyle: 'short',
                                    timeZone: zone ?? 'UTC',
                                  }).format(new Date(vedic[k].endsAt)),
                                }),
                          })}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {content('panchang')}
              </details>
            </section>
            <section className="report-card" data-daily-block="10">
              <h2>{t('daily.doDont')}</h2>
              <div className="daily-grid">
                {(['do', 'dont'] as const).map((k) => (
                  <div key={k}>
                    <h3>{t(`daily.${k}`)}</h3>
                    <ul>
                      {(report.doDont?.[k] ?? []).map((v) => (
                        <li key={v}>{t('report.content', { text: v })}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <ShareDialog
                daily={{
                  locale,
                  date: chart.date.local,
                  headline: intl(chart.oneLiner),
                  stars: stars(chart.scores.overall),
                  color: intl(chart.bazi.luckyColor[0]!),
                  numbers: chart.bazi.luckyNumbers,
                  do: report.doDont?.do ?? [],
                  dont: report.doDont?.dont ?? [],
                }}
              />
            </section>
            <section className="report-card" data-daily-block="11">
              <h2>{t('daily.period')}</h2>
              <div className="action-row">
                <Button disabled>{t('daily.week')}</Button>
                <Button disabled>{t('daily.month')}</Button>
              </div>
              <p>{t('daily.periodSoon')}</p>
            </section>
            <section className="report-card" data-daily-block="12">
              <h2>{t('daily.feedback')}</h2>
              {([1, -1] as const).map((n) => (
                <Button
                  key={n}
                  variant="ghost"
                  disabled={vote !== null}
                  aria-label={t(n === 1 ? 'daily.feedbackYes' : 'daily.feedbackNo')}
                  onClick={() => {
                    void submitFeedbackAction({ sectionKey: 'daily', vote: n }).then((r) => {
                      if (r.ok) setVote(n);
                      else setError(true);
                    });
                  }}
                >
                  {n === 1 ? '👍' : '👎'}
                </Button>
              ))}
              {vote !== null ? <p role="status">{t('daily.feedbackSaved')}</p> : null}
            </section>
          </div>
        </div>
      ) : null}
      {chart && zone && !busy && !error ? (
        <JournalForm
          key={`${profileId}:${chart.date.local}`}
          profileId={profileId}
          signedIn={signedIn}
          date={chart.date.local}
          tz={zone}
        />
      ) : null}
      <p>{t('report.disclaimer.short')}</p>
    </article>
  );
}
