import { describe, expect, it } from 'vitest';
import { dailyDateSearch, parseDailyDate, shiftDate } from '../lib/daily-date';

describe('daily date parameter', () => {
  it('accepts real civil dates inside the engine range only', () => {
    expect(parseDailyDate('2026-11-16')).toBe('2026-11-16');
    expect(parseDailyDate('1900-01-01')).toBe('1900-01-01');
    expect(parseDailyDate('2100-12-31')).toBe('2100-12-31');
    for (const bad of [null, '', '2026-02-30', '1899-12-31', '2101-01-01', '2026-1-5', 'today'])
      expect(parseDailyDate(bad)).toBeNull();
  });
  it('shifts across month and year boundaries', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('drops the parameter for today and keeps unrelated query values', () => {
    expect(dailyDateSearch('?date=2026-11-16', '2026-11-15', '2026-11-15')).toBe('');
    expect(dailyDateSearch('', '2026-11-16', '2026-11-15')).toBe('?date=2026-11-16');
    expect(dailyDateSearch('?ref=share&date=2026-11-10', '2026-11-11', '2026-11-15')).toBe(
      '?ref=share&date=2026-11-11',
    );
  });
});
