// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { BirthForm } from '../components/forms/birth-form';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import { birthError, lunarMonths, isUnderThirteen } from '../lib/birth-form';
import type { BirthInput } from '@tianji/shared';
vi.mock('../app/readings/actions', () => ({
  createReadingAction: vi.fn(),
  upsertProfileAction: vi.fn(),
  blockAgeAction: vi.fn(),
}));
vi.mock('../i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
afterEach(cleanup);
const input: BirthInput = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 15,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  gender: 'male',
};
for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  describe(`BirthForm ${locale}`, () => {
    const show = () =>
      render(
        <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
          <BirthForm />
        </NextIntlClientProvider>,
      );
    it('offers exactly 13 branches and disables the clock for unknown birth time', () => {
      show();
      expect(screen.getAllByRole('option')).toHaveLength(13);
      fireEvent.click(screen.getByLabelText(catalog['form.birth.timeUnknown']));
      expect(
        (screen.getByLabelText(catalog['form.birth.hourBranch']) as HTMLSelectElement).disabled,
      ).toBe(true);
      expect(screen.getByText(catalog['form.birth.timeUnknown.help'])).toBeTruthy();
    });
    it('validates impossible Gregorian dates before moving to step two', () => {
      show();
      fireEvent.change(screen.getByLabelText(catalog['form.birth.year']), {
        target: { value: '1990' },
      });
      fireEvent.change(screen.getByLabelText(catalog['form.birth.month']), {
        target: { value: '2' },
      });
      fireEvent.change(screen.getByLabelText(catalog['form.birth.day']), {
        target: { value: '30' },
      });
      expect(screen.getByRole('alert').textContent).toBe(catalog['engine.errors.E_INVALID_INPUT']);
      expect(screen.queryByLabelText(catalog['form.birth.city'])).toBeNull();
    });
  });
}
describe('calendar and age validation', () => {
  it('only exposes real leap months', () => {
    expect(
      lunarMonths(1993)
        .filter((m) => m.month < 0)
        .map((m) => m.month),
    ).toEqual([-3]);
    expect(lunarMonths(1990).every((m) => m.days === 29 || m.days === 30)).toBe(true);
    expect(
      birthError({ ...input, calendar: 'lunar', year: 1993, month: 4, isLeapMonth: true }, 'zh'),
    ).toBe('engine.errors.E_LUNAR_NO_LEAP_MONTH');
  });
  it('checks the exact birthday and lunar-to-Gregorian conversion', () => {
    const now = new Date('2026-10-05T00:00:00Z');
    expect(isUnderThirteen({ ...input, year: 2013, month: 10, day: 6 }, 'zh', now)).toBe(true);
    expect(isUnderThirteen({ ...input, year: 2013, month: 10, day: 5 }, 'zh', now)).toBe(false);
    expect(isUnderThirteen({ ...input, calendar: 'lunar', year: 2020 }, 'zh', now)).toBe(true);
  });
  it('rejects invalid IANA zones and ignores stale unknown-clock fields', () => {
    expect(
      birthError({ ...input, place: { name: 'x', lat: 0, lng: 0, tz: 'invalid' } }, 'en'),
    ).toBe('engine.errors.E_INVALID_INPUT');
    expect(birthError({ ...input, timeUnknown: true, hour: 99, minute: 99 }, 'en')).toBeNull();
  });
});
