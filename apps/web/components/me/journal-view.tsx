'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Temporal } from '@js-temporal/polyfill';
import type { Locale } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getJournalMonthAction } from '@/app/me/journal/actions';
import { localToday } from '@/lib/daily-date';
import type { JournalMonth } from '@/lib/journal-service';
import { journalStars } from '@/lib/journal-stats';
// DESIGN-GAP: B-16 defines no copy keys; journal.* and me.journal extend next-intl for all supported locales.
/** Month/list comparison and all-time Mirror summary for the selected private profile. */
export function JournalView({ profileId, tz }: { profileId: string; tz: string | null }) {
  const t = useCopy(),
    locale = useLocale() as Locale;
  const [zone, setZone] = useState<string | null>(tz),
    [month, setMonth] = useState<string | null>(null);
  const [value, setValue] = useState<JournalMonth | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<'month' | 'list'>('month');
  useEffect(() => {
    const currentZone =
      tz ?? localStorage.getItem('tianji-tz') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    setZone(currentZone);
    setMonth(localToday(currentZone).slice(0, 7));
  }, [tz]);
  useEffect(() => {
    if (!zone || !month) return;
    let active = true;
    setBusy(true);
    setError(false);
    setValue(null);
    void getJournalMonthAction({ profileId, month, tz: zone, locale })
      .then((result) => {
        if (!active) return;
        if (result.ok) setValue(result.data);
        else setError(true);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [zone, month, profileId, locale, retry]);
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  const entries = new Map(value?.entries.map((entry) => [entry.date, entry]));
  const number = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const stats = value?.stats;
  function switchMonth(amount: number) {
    if (month)
      setMonth(
        Temporal.PlainDate.from(`${month}-01`).add({ months: amount }).toString().slice(0, 7),
      );
  }
  return (
    <div aria-busy={busy}>
      <section className="report-card">
        <h2>{t('journal.mirror')}</h2>
        {stats ? (
          <>
            <dl className="daily-grid" data-journal-stats>
              <div>
                <dt>{t('journal.correlation')}</dt>
                <dd>
                  {stats.correlation === null
                    ? t('journal.insufficient')
                    : t('report.content', { text: number(stats.correlation) })}
                </dd>
              </div>
              <div>
                <dt>{t('journal.streak')}</dt>
                <dd>{t('journal.days', { count: stats.streak })}</dd>
              </div>
              <div>
                <dt>{t('journal.longest')}</dt>
                <dd>{t('journal.days', { count: stats.longestStreak })}</dd>
              </div>
              <div>
                <dt>{t('journal.domain')}</dt>
                <dd>
                  {stats.domains.length
                    ? stats.domains.map((d) => (
                        <p key={d.domain}>
                          {t(`daily.dimension.${d.domain}` as MessageKey)} ·{' '}
                          {t('journal.hits', { count: d.hits })}
                        </p>
                      ))
                    : t('journal.noHits')}
                </dd>
              </div>
            </dl>
            <p>{t('journal.samples', { count: stats.count })}</p>
          </>
        ) : null}
        <details>
          <summary>{t('journal.methodLabel')}</summary>
          <p>{t('journal.method')}</p>
        </details>
      </section>
      <section className="report-card">
        <nav className="action-row" aria-label={t('calendar.monthNav')}>
          <Button
            variant="ghost"
            disabled={!month || month === '1900-01' || busy}
            onClick={() => switchMonth(-1)}
          >
            {t('calendar.previous')}
          </Button>
          <h2 aria-live="polite">
            {month
              ? format(`${month}-01`, { year: 'numeric', month: 'long' })
              : t('common.loading')}
          </h2>
          <Button
            variant="ghost"
            disabled={!month || month === '2100-12' || busy}
            onClick={() => switchMonth(1)}
          >
            {t('calendar.next')}
          </Button>
        </nav>
        {zone ? <p>{t('calendar.zone', { zone })}</p> : null}
        <div className="action-row">
          <Button variant="ghost" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>
            {t('journal.monthView')}
          </Button>
          <Button variant="ghost" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
            {t('journal.listView')}
          </Button>
          <Link href="/today/calendar" className="text-link">
            {t('calendar.title')}
          </Link>
        </div>
        {busy ? <p role="status">{t('common.loading')}</p> : null}
        {error ? (
          <p role="alert">
            {t('journal.loadError')}{' '}
            <Button onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</Button>
          </p>
        ) : null}
        {value && !value.entries.length ? <p>{t('journal.empty')}</p> : null}
        {value && mode === 'month' && month ? (
          <>
            <p>{t('journal.legend')}</p>
            <div className="journal-calendar" role="group" aria-label={t('journal.monthView')}>
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="journal-weekday">
                  {format(`2026-10-${String(5 + i).padStart(2, '0')}`, { weekday: 'short' })}
                </span>
              ))}
              {value.days.map((day, i) => {
                const entry = entries.get(day.date),
                  score = entry?.prediction.scores.overall ?? day.overall;
                return (
                  <Link
                    key={day.date}
                    href={{ pathname: '/today', query: { date: day.date } }}
                    data-journal-day={day.date}
                    className={`journal-day ${entry ? 'journal-recorded' : ''}`}
                    style={
                      i === 0
                        ? { gridColumnStart: Temporal.PlainDate.from(`${month}-01`).dayOfWeek }
                        : undefined
                    }
                    aria-label={t('journal.dayLabel', {
                      date: format(day.date, { dateStyle: 'full' }),
                      forecast: journalStars(score),
                      mood: entry ? number(entry.mood) : t('journal.noMood'),
                    })}
                  >
                    <time dateTime={day.date}>{i + 1}</time>
                    <span className="journal-forecast" aria-hidden>
                      {'★'.repeat(journalStars(score))}
                    </span>
                    <span className="journal-actual">
                      {entry
                        ? t('journal.moodValue', { mood: entry.mood })
                        : t('journal.missingMood')}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
        {value && mode === 'list' ? (
          <ul className="journal-list">
            {value.entries.map((entry) => (
              <li key={entry.id} data-journal-entry={entry.date}>
                <Link
                  className="text-link"
                  href={{ pathname: '/today', query: { date: entry.date } }}
                >
                  <time dateTime={entry.date}>{format(entry.date, { dateStyle: 'long' })}</time>
                </Link>
                <p>
                  {t('journal.comparison', {
                    forecast: journalStars(entry.prediction.scores.overall),
                    mood: entry.mood,
                  })}
                </p>
                <p>{t('report.content', { text: entry.text })}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
