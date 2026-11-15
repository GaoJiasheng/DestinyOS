import { spacing } from '@tianji/ui-core/tokens';
import { View } from 'react-native';
import { Temporal } from '@js-temporal/polyfill';
import { useCopy } from '../../lib/copy';
import { Action } from '../native-ui';

/** Same 1900–2100 window as the calendar and the shared daily engine. */
export const dailyDateRange = { min: '1900-01-01', max: '2100-12-31' } as const;
export const shiftDay = (date: string, days: number) =>
  Temporal.PlainDate.from(date).add({ days }).toString();
export const inDailyRange = (date: string) =>
  date >= dailyDateRange.min && date <= dailyDateRange.max;

/**
 * Mirrors the Web control: on today a yesterday/today/tomorrow segment; on any other day a
 * previous/selected/next pager plus "back to today", so labels stay true relative to the real today.
 */
export function DailyDateNav({
  date,
  today,
  label,
  busy,
  onSelect,
}: {
  date: string;
  today: string;
  /** Localized short label for the selected day. */
  label: string;
  busy: boolean;
  onSelect: (date: string) => void;
}) {
  const t = useCopy();
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') } as const;
  if (date === today)
    return (
      <View style={row} accessibilityLabel={t('daily.dateNav')}>
        <Action
          id="daily-prev"
          label={t('daily.yesterday')}
          selected={false}
          disabled={busy}
          onPress={() => onSelect(shiftDay(today, -1))}
        />
        <Action id="daily-now" label={t('daily.today')} selected onPress={() => onSelect(today)} />
        <Action
          id="daily-next"
          label={t('daily.tomorrow')}
          selected={false}
          disabled={busy}
          onPress={() => onSelect(shiftDay(today, 1))}
        />
      </View>
    );
  return (
    <View style={{ gap: spacing('space-2') }} accessibilityLabel={t('daily.dateNav')}>
      <View style={row}>
        <Action
          id="daily-prev"
          label={t('daily.previousDay')}
          selected={false}
          disabled={busy || date <= dailyDateRange.min}
          onPress={() => onSelect(shiftDay(date, -1))}
        />
        <Action id="daily-now" label={label} selected onPress={() => onSelect(date)} />
        <Action
          id="daily-next"
          label={t('daily.nextDay')}
          selected={false}
          disabled={busy || date >= dailyDateRange.max}
          onPress={() => onSelect(shiftDay(date, 1))}
        />
      </View>
      <Action
        id="daily-back-today"
        label={t('daily.backToToday')}
        onPress={() => onSelect(today)}
      />
    </View>
  );
}
