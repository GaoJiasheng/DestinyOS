'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading } from '@/lib/reading-schema';
import { translateAnonymousReportAction } from '@/app/readings/actions';
import { ReportLayout } from './report-layout';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { formatClock } from './report-utils';
import { useOfflineShell } from '@/components/pwa/use-offline-shell';
/** Plain or structured cast input both carry the asker's text; anything else shows no question line. */
function askedQuestion(question: LocalReading['request']['question']): string | undefined {
  const text =
    typeof question === 'string' ? question : (question?.text ?? question?.question ?? undefined);
  return typeof text === 'string' && text.trim() ? text.trim() : undefined;
}
/** Load authenticated device ciphertext; a locale change translates the saved chart instead of recomputing.
 * A failed translation falls back to the report's original language instead of reporting a storage error. */
export function LocalReport({ id, system }: { id: string; system: string }) {
  const t = useCopy();
  const locale = useLocale() as 'zh' | 'en' | 'zh-TW';
  const [reading, setReading] = useState<LocalReading | null>(null);
  const [error, setError] = useState<'report.localMissing' | 'report.storageError' | null>(null);
  const [fallback, setFallback] = useState(false);
  // React re-runs effects when a hidden Suspense subtree is revealed; reloading then would remount
  // the report and drop its view state, so an already loaded report is kept.
  const loaded = useRef('');
  // Read after hydration: the stored offline page is the same markup whichever state it was saved in.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useOfflineShell(reading !== null);
  useEffect(() => {
    const key = `${system}:${id}:${locale}`;
    if (loaded.current === key) return;
    let active = true;
    setReading(null);
    setError(null);
    setFallback(false);
    void readAnonymous()
      .then(async (data) => {
        const found = data?.readings.find((r) => r.id === id && r.system === system);
        if (!found) {
          if (active) setError('report.localMissing');
          return;
        }
        const saved =
          locale === 'zh-TW' ? found.reportZhTw : locale === 'zh' ? found.reportZh : found.reportEn;
        let report = saved ?? (found.report.locale === locale ? found.report : null);
        if (!report) {
          const result = await translateAnonymousReportAction(found, locale).catch(() => null);
          if (!result?.ok) {
            if (active) {
              loaded.current = key;
              setFallback(true);
              setReading(found);
            }
            return;
          }
          report = result.data;
          const translated = report;
          // Caching the translation is best effort; the translated report is shown either way.
          await updateAnonymous((d) => ({
            ...d,
            readings: d.readings.map((r) =>
              r.id === id
                ? {
                    ...r,
                    [locale === 'zh-TW' ? 'reportZhTw' : locale === 'zh' ? 'reportZh' : 'reportEn']:
                      translated,
                  }
                : r,
            ),
          })).catch(() => undefined);
        }
        if (active) {
          loaded.current = key;
          setReading({ ...found, report });
        }
      })
      .catch(() => {
        if (active) setError('report.storageError');
      });
    return () => {
      active = false;
    };
  }, [id, locale, system]);
  if (error === 'report.localMissing')
    return (
      <section className="status-page" role="alert">
        <p>{t(error)}</p>
        <div className="hero-actions">
          <Button asChild>
            <Link href={`/${system}`}>{t('report.localMissingRecalc')}</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/me/history">{t('report.localMissingHistory')}</Link>
          </Button>
        </div>
      </section>
    );
  if (error)
    return (
      <p className="status-page" role="alert">
        {t(error)}
      </p>
    );
  if (!reading)
    return (
      <div className="status-page report-skeleton" role="status">
        {t('report.loading')}
      </div>
    );
  const b = reading.request.birth;
  return (
    <>
      {offline ? (
        <p className="notice report-offline" role="status">
          {t('report.offlineNotice')}
        </p>
      ) : null}
      {fallback ? (
        <p className="notice report-locale-fallback" role="status">
          {t('report.localTranslateFailed')}
        </p>
      ) : null}
      <ReportLayout
        reading={reading}
        local
        question={askedQuestion(reading.request.question)}
        birthDetails={
          b
            ? `${b.year}-${b.month}-${b.day} · ${b.timeUnknown ? '—' : formatClock(b.hour, b.minute)} · ${b.place?.name ?? ''} · ${b.place?.tz ?? ''}`
            : undefined
        }
      />
    </>
  );
}
