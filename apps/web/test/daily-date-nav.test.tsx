// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { toMessages, runtimeKey } from '../i18n/catalog';
import zh from '../messages/zh.json';
import type { CalendarEvent } from '@tianji/engine/calendar';
vi.mock('../i18n/use-copy', () => ({
  useCopy: () => {
    const t = createTranslator({ locale: 'zh', messages: toMessages(zh) });
    return (key: string, values?: Record<string, string>) => t(runtimeKey(key), values);
  },
}));
import { DailyDateNav } from '../components/daily/daily-date-nav';
import { splitCalendarEvents } from '../components/daily/calendar-events';
afterEach(cleanup);

describe('daily date control', () => {
  it('marks today as current and selects neighbouring dates', () => {
    const onSelect = vi.fn();
    render(<DailyDateNav date="2026-11-15" today="2026-11-15" label="" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: zh['daily.today'] })).toHaveProperty(
      'ariaCurrent',
      'date',
    );
    fireEvent.click(screen.getByRole('button', { name: zh['daily.tomorrow'] }));
    fireEvent.click(screen.getByRole('button', { name: zh['daily.yesterday'] }));
    expect(onSelect.mock.calls).toEqual([['2026-11-16'], ['2026-11-14']]);
  });
  it('pages day by day away from today and offers a way back', () => {
    const onSelect = vi.fn();
    render(
      <DailyDateNav
        date="2026-11-16"
        today="2026-11-15"
        label="11月16日周一"
        onSelect={onSelect}
      />,
    );
    expect(screen.queryByRole('button', { name: zh['daily.tomorrow'] })).toBeNull();
    expect(screen.getByText('11月16日周一').getAttribute('aria-current')).toBe('date');
    fireEvent.click(screen.getByRole('button', { name: zh['daily.nextDay'] }));
    fireEvent.click(screen.getByRole('button', { name: zh['daily.previousDay'] }));
    fireEvent.click(screen.getByRole('button', { name: zh['daily.backToToday'] }));
    expect(onSelect.mock.calls).toEqual([['2026-11-17'], ['2026-11-15'], ['2026-11-15']]);
  });
  it('disables paging past the calculable range', () => {
    render(<DailyDateNav date="2100-12-31" today="2026-11-15" label="end" onSelect={vi.fn()} />);
    expect(
      (screen.getByRole('button', { name: zh['daily.nextDay'] }) as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    render(<DailyDateNav date="1900-01-01" today="2026-11-15" label="start" onSelect={vi.fn()} />);
    expect(
      (screen.getByRole('button', { name: zh['daily.previousDay'] }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('annual calendar list', () => {
  const event = (date: string, endDate?: string): CalendarEvent => ({
    kind: 'new_moon',
    at: `${date}T00:00:00.000Z`,
    date,
    ...(endDate ? { endDate } : {}),
  });
  it('keeps today and ongoing intervals upcoming and folds the rest into past', () => {
    const { upcoming, past } = splitCalendarEvents(
      [
        event('2026-01-05'),
        event('2026-11-01', '2026-11-20'),
        event('2026-11-15'),
        event('2026-12-01'),
      ],
      '2026-11-15',
    );
    expect(past.map((e) => e.date)).toEqual(['2026-01-05']);
    expect(upcoming.map((e) => e.date)).toEqual(['2026-11-01', '2026-11-15', '2026-12-01']);
  });
});
