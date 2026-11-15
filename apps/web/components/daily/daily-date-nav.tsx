'use client';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { dailyDateRange, shiftDate } from '@/lib/daily-date';

/**
 * Today shows a yesterday/today/tomorrow segmented control; any other date becomes a
 * previous/selected/next pager with a way back, so browsing can continue past one day.
 */
export function DailyDateNav({
  date,
  today,
  label,
  onSelect,
}: {
  /** Selected civil date, or null while the zone is still resolving. */
  date: string | null;
  today: string | null;
  /** Localized short label for the selected date. */
  label: string;
  onSelect: (date: string) => void;
}) {
  const t = useCopy();
  const ready = Boolean(date && today);
  if (!date || !today || date === today) {
    const options = [
      { key: 'daily.yesterday', days: -1 },
      { key: 'daily.today', days: 0 },
      { key: 'daily.tomorrow', days: 1 },
    ] as const;
    return (
      <nav className="daily-date-nav" aria-label={t('daily.dateNav')}>
        <div className="daily-date-segments">
          {options.map(({ key, days }) => (
            <Button
              key={key}
              variant={days === 0 ? undefined : 'ghost'}
              aria-current={days === 0 ? 'date' : undefined}
              disabled={!ready}
              onClick={() => today && onSelect(shiftDate(today, days))}
            >
              {t(key)}
            </Button>
          ))}
        </div>
      </nav>
    );
  }
  return (
    <nav className="daily-date-nav" aria-label={t('daily.dateNav')}>
      <div className="daily-date-segments">
        <Button
          variant="ghost"
          disabled={date <= dailyDateRange.min}
          onClick={() => onSelect(shiftDate(date, -1))}
        >
          {t('daily.previousDay')}
        </Button>
        <span className="button button-primary daily-date-current" aria-current="date">
          {label}
        </span>
        <Button
          variant="ghost"
          disabled={date >= dailyDateRange.max}
          onClick={() => onSelect(shiftDate(date, 1))}
        >
          {t('daily.nextDay')}
        </Button>
      </div>
      <Button variant="secondary" onClick={() => onSelect(today)}>
        {t('daily.backToToday')}
      </Button>
    </nav>
  );
}
