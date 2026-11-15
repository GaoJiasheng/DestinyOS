'use client';
import { DailyArt } from '@/components/art/daily-art';
import { DailyPanchang } from './daily-panchang';
import { DailyLuckyRow } from './daily-lucky-row';
import { DailyPeriodSection } from './daily-period-section';
import { DailySkyNote, moonPhaseEmoji, useDimensionCopy } from './daily-dimension-copy';
import { useCallback, useMemo, useRef } from 'react';
import { dailyStars } from '@tianji/engine/daily';
import type { KnowledgeBundle } from '@tianji/content';
import { useDailyReport } from './use-daily-report';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type BirthInput, type Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  localToday,
  parseDailyDate,
  shiftDate,
  dailyDateRange,
  dailyDateSearch,
} from '@/lib/daily-date';
import { DailyDateNav } from './daily-date-nav';
import { DailyFeedback } from './daily-feedback';
import { DailyProfileCta } from './daily-profile-cta';
import { dailyExcerpt } from '@/lib/daily-excerpt';
import { ShareDialog } from '@/components/share/share-dialog';
import { JournalForm } from '@/components/me/journal-form';
import { AdSlot } from '@/components/report/report-section';
/** Thirteen daily blocks, local anonymous computation, bounded date controls and touch navigation. */
// DESIGN-GAP: 未规定的五要素历中文名采用月日/瑜伽序号、半日类型号与中文星期；星宿复用已有 glossary 译名。
export function TodayView({
  signedIn,
  profileId,
  birth,
  seedIdentity,
  knowledge,
  tz,
  plan,
  vedicUsed,
  panchangDefaultOpen = false,
}: {
  signedIn: boolean;
  profileId?: string;
  birth?: BirthInput;
  seedIdentity?: string;
  knowledge?: KnowledgeBundle;
  tz?: string | null;
  plan: 'free' | 'pro';
  vedicUsed: boolean;
  panchangDefaultOpen?: boolean;
}) {
  const requestedDate = parseDailyDate(useSearchParams().get('date'));
  const t = useCopy(),
    intl = useTranslations(),
    locale = useLocale() as Locale;
  const {
    zone,
    value,
    example,
    error,
    busy,
    setRetry,
    panchang,
    setPanchang,
    flipped,
    setFlipped,
    vote,
    setVote,
  } = useDailyReport({
    signedIn,
    profileId,
    birth,
    seedIdentity,
    knowledge,
    tz,
    locale,
    requestedDate,
    vedicUsed,
    panchangDefaultOpen,
  });
  const touch = useRef<{ x: number; y: number } | null>(null);
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
  const dimensionCopy = useDimensionCopy(chart, locale);
  const today = useMemo(() => (zone ? localToday(zone) : null), [zone]);
  const selected = requestedDate ?? today;
  const isToday = !requestedDate || requestedDate === today;
  const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  // Native history updates keep the prerendered shell (no RSC round-trip) while useSearchParams stays in sync.
  const selectDate = useCallback(
    (date: string) => {
      if (!today || date < dailyDateRange.min || date > dailyDateRange.max) return;
      window.dispatchEvent(
        new CustomEvent('tianji:event', { detail: { name: 'daily.date.switch' } }),
      );
      // null (not the current state) lets the router apply the URL; it copies its own internals itself.
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${dailyDateSearch(window.location.search, date, today)}`,
      );
    },
    [today],
  );
  const switchDate = (days: number) => {
    if (selected) selectDate(shiftDate(selected, days));
  };
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
          switchDate(p.clientX < start.x ? 1 : -1);
        touch.current = null;
      }}
    >
      <header data-daily-block="1">
        <h1 className="type-h1">
          {isToday || !selected ? t('nav.today') : formatDate(selected, { dateStyle: 'long' })}
        </h1>
        <Link href="/today/calendar" className="text-link">
          {t('calendar.title')}
        </Link>
        <DailyDateNav
          date={selected}
          today={today}
          label={
            selected
              ? formatDate(selected, { month: 'short', day: 'numeric', weekday: 'short' })
              : ''
          }
          onSelect={selectDate}
        />
        {chart ? (
          <>
            <time dateTime={chart.date.local}>
              {formatDate(chart.date.local, { dateStyle: 'full' })}
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
              · <span aria-hidden>{moonPhaseEmoji[chart.astro.moonPhase.name]}</span>{' '}
              {intl(`daily.moonPhase.${chart.astro.moonPhase.name}`)}
            </p>
            {chart.date.solarTerm ? <p>{intl(`home.term.${chart.date.solarTerm.name}`)}</p> : null}
          </>
        ) : null}
      </header>
      {busy ? <p role="status">{t('common.loading')}</p> : null}
      {error ? (
        <div role="alert">
          {t(error === 'timeout' ? 'daily.error.timeout' : 'report.error.E_INTERNAL')}{' '}
          <Button onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</Button>
        </div>
      ) : null}
      {value && chart && report ? (
        <div className="daily-body" aria-busy={busy}>
          {example ? (
            <div className="daily-example-overlay">
              <p>{t('daily.example')}</p>
              <Link
                href={{ pathname: '/me/birth', query: { from: '/today' } }}
                className="text-link"
              >
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
                aria-label={`${t('daily.overall')} · ${t(`daily.rating.${dailyStars(chart.scores.overall)}` as MessageKey)}`}
              >
                <span aria-hidden>
                  {t(`daily.rating.${dailyStars(chart.scores.overall)}` as MessageKey)}
                </span>
              </div>
              <div className="daily-grid">
                {(['career', 'wealth', 'love', 'health', 'social'] as const).map((k) => (
                  <div key={k}>
                    <h3>{t(`daily.dimension.${k}`)}</h3>
                    <p aria-label={t('daily.stars', { count: dailyStars(chart.scores[k]) })}>
                      {'★'.repeat(dailyStars(chart.scores[k]))}
                      {'☆'.repeat(5 - dailyStars(chart.scores[k]))}
                    </p>
                    <p data-daily-note={k}>
                      {dimensionCopy(k)?.note ??
                        t(`daily.rating.${k}.${dailyStars(chart.scores[k])}` as MessageKey)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <section className="report-card" data-daily-block="4">
              <h2>{t('daily.lucky')}</h2>
              <DailyLuckyRow bazi={chart.bazi} />
            </section>
          </div>
          {example ? (
            <DailyProfileCta
              title={t('daily.exampleCta.title')}
              body={t('daily.exampleCta.body')}
              action={t('daily.profileCTA')}
              from="/today"
            />
          ) : (
            <>
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
                {(['career', 'wealth', 'love', 'health'] as const).map((k) => (
                  <div key={k} data-daily-body={k}>
                    <h2>{title(k)}</h2>
                    {dimensionCopy(k) ? <p>{dimensionCopy(k)?.paragraph}</p> : content(k)}
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
                <DailySkyNote chart={chart} locale={locale} />
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
              <DailyPanchang
                vedic={vedic}
                panchang={panchang}
                setPanchang={setPanchang}
                locale={locale}
                zone={zone}
              >
                {content('panchang')}
              </DailyPanchang>
              <section className="report-card" data-daily-block="10">
                <h2>
                  <DailyArt kind="do-dont" alt={t('daily.doDont')} />
                  {t('daily.doDont')}
                </h2>
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
                    stars: dailyStars(chart.scores.overall),
                    color: intl(chart.bazi.luckyColor[0]!),
                    numbers: chart.bazi.luckyNumbers,
                    do: report.doDont?.do ?? [],
                    dont: report.doDont?.dont ?? [],
                  }}
                />
              </section>
              <DailyPeriodSection
                date={chart.date.local}
                zone={zone}
                signedIn={signedIn}
                profileId={profileId}
                locale={locale}
                example={example}
              />
              <DailyFeedback vote={vote} setVote={setVote} />
            </>
          )}
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
