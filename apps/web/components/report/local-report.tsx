'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading } from '@/lib/reading-schema';
import { translateAnonymousReportAction } from '@/app/readings/actions';
import { ReportLayout } from './report-layout';
/** Load authenticated device ciphertext; a locale change translates the saved chart instead of recomputing. */
export function LocalReport({ id, system }: { id: string; system: string }) {
  const t = useCopy();
  const locale = useLocale() as 'zh' | 'en';
  const [reading, setReading] = useState<LocalReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setReading(null);
    setError(null);
    void readAnonymous()
      .then(async (data) => {
        const found = data?.readings.find((r) => r.id === id && r.system === system);
        if (!found) {
          if (active) setError('report.localMissing');
          return;
        }
        const saved = locale === 'zh' ? found.reportZh : found.reportEn;
        let report = saved ?? (found.report.locale === locale ? found.report : null);
        if (!report) {
          const result = await translateAnonymousReportAction(found, locale);
          if (!result.ok) throw new Error(result.error.code);
          report = result.data;
          const translated = report;
          await updateAnonymous((d) => ({
            ...d,
            readings: d.readings.map((r) =>
              r.id === id ? { ...r, [locale === 'zh' ? 'reportZh' : 'reportEn']: translated } : r,
            ),
          }));
        }
        if (active) setReading({ ...found, report });
      })
      .catch(() => {
        if (active) setError('report.storageError');
      });
    return () => {
      active = false;
    };
  }, [id, locale, system]);
  if (error)
    return (
      <p className="status-page" role="alert">
        {t(error as 'report.localMissing' | 'report.storageError')}
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
    <ReportLayout
      reading={reading}
      local
      birthDetails={
        b
          ? `${b.year}-${b.month}-${b.day} · ${b.timeUnknown ? '—' : `${b.hour}:${b.minute}`} · ${b.place?.name ?? ''} · ${b.place?.tz ?? ''}`
          : undefined
      }
    />
  );
}
