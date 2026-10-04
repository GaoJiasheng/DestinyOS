'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { readAnonymous } from '@/lib/anonymous-storage';
import type { LocalReading } from '@/lib/reading-schema';
/** Recover encrypted device reports so an offline tarot result remains accessible after the ritual ends. */
export function LocalHistory({ limit = 50 }: { limit?: number }) {
  const t = useCopy();
  const locale = useLocale();
  const [readings, setReadings] = useState<LocalReading[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void readAnonymous()
      .then((data) => {
        if (active)
          setReadings(
            [...(data?.readings ?? [])]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, limit),
          );
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [limit]);
  if (error) return <p role="alert">{t('report.storageError')}</p>;
  return (
    <ul className="history-list">
      {readings.map((reading) => (
        <li className="report-card" key={reading.id}>
          <Link href={`/${reading.system}/r/local/${reading.id}`}>
            <h2 className="type-h3">
              {reading.title
                ? t('report.content', { text: reading.title })
                : t(`nav.${reading.system}` as MessageKey)}
            </h2>
            <time dateTime={reading.createdAt}>
              {t('report.content', {
                text: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                  new Date(reading.createdAt),
                ),
              })}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
