'use client';
import type { ReactNode } from 'react';
import type { DailyChart, Locale } from '@tianji/shared';
import { useTranslations } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
/** Panchang values with explicit timezone formatting and the existing translated fallback. */
export function DailyPanchang({
  vedic,
  panchang,
  setPanchang,
  locale,
  zone,
  children,
}: {
  vedic: DailyChart['vedic'] | undefined;
  panchang: boolean;
  setPanchang: (value: boolean) => void;
  locale: Locale;
  zone: string | null;
  children: ReactNode;
}) {
  const t = useCopy();
  const intl = useTranslations();
  const title = (key: string) => intl(`report.sections.daily.${key}`);
  return (
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
        {children}
      </details>
    </section>
  );
}
