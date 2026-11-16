// @vitest-environment jsdom
import type React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { BirthForm } from '../components/forms/birth-form';
import { toMessages } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import { birthError, lunarMonths, isUnderThirteen, switchCalendar } from '../lib/birth-form';
import { dateIssues } from '../lib/birth-form-validate';
import { safeReturnTo } from '../lib/birth-form-draft';
import type { BirthInput } from '@tianji/shared';
vi.mock('../app/readings/actions', () => ({
  createReadingAction: vi.fn(),
  upsertProfileAction: vi.fn(),
  blockAgeAction: vi.fn(),
}));
vi.mock('../lib/consent', () => ({ afterConsent: (proceed: () => void) => proceed() }));
vi.mock('../i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});
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
    it('offers exactly 13 branches, none preselected, and disables the clock for unknown birth time', () => {
      show();
      const hour = screen.getByLabelText(catalog['form.birth.hourBranch']) as HTMLSelectElement;
      expect(hour.value).toBe('');
      expect([...hour.options].filter((o) => o.value !== '')).toHaveLength(13);
      for (const field of ['year', 'month', 'day'] as const)
        expect(
          (screen.getByLabelText(catalog[`form.birth.${field}`]) as HTMLInputElement).value,
        ).toBe('');
      fireEvent.click(screen.getByLabelText(catalog['form.birth.timeUnknown']));
      expect(
        (screen.getByLabelText(catalog['form.birth.hourBranch']) as HTMLSelectElement).disabled,
      ).toBe(true);
      expect(screen.getByText(catalog['form.birth.timeUnknown.help'])).toBeTruthy();
    });
    it('reports the exact missing day beside the field only after leaving it or submitting', async () => {
      show();
      const day = screen.getByLabelText(catalog['form.birth.day']);
      fireEvent.change(screen.getByLabelText(catalog['form.birth.year']), {
        target: { value: '1' },
      });
      expect(screen.queryByText(catalog['engine.errors.E_DATE_OUT_OF_RANGE'])).toBeNull();
      fireEvent.change(screen.getByLabelText(catalog['form.birth.year']), {
        target: { value: '1990' },
      });
      fireEvent.change(screen.getByLabelText(catalog['form.birth.month']), {
        target: { value: '6' },
      });
      fireEvent.change(day, { target: { value: '31' } });
      fireEvent.blur(day);
      const message = screen.getByText(
        locale === 'zh' ? '6 月没有 31 日。' : 'June has no day 31.',
      );
      expect(day.getAttribute('aria-describedby')).toBe(message.id);
      expect(screen.queryByLabelText(catalog['form.birth.city'])).toBeNull();
    });
    it('requires an hour (or unknown time) and focuses the first invalid field on submit', async () => {
      show();
      fireEvent.change(screen.getByLabelText(catalog['form.birth.year']), {
        target: { value: '1990' },
      });
      fireEvent.change(screen.getByLabelText(catalog['form.birth.month']), {
        target: { value: '5' },
      });
      fireEvent.change(screen.getByLabelText(catalog['form.birth.day']), {
        target: { value: '15' },
      });
      fireEvent.click(screen.getByRole('button', { name: catalog['form.birth.next'] }));
      await screen.findByText(catalog['form.birth.error.hourRequired']);
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByLabelText(catalog['form.birth.hourBranch']),
        ),
      );
      fireEvent.change(screen.getByLabelText(catalog['form.birth.hourBranch']), {
        target: { value: '7' },
      });
      fireEvent.click(screen.getByRole('button', { name: catalog['form.birth.next'] }));
      await screen.findByLabelText(catalog['form.birth.city']);
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

describe('rectified birth provenance', () => {
  it('preserves trial metadata on reuse and clears it when the user changes birth facts', async () => {
    const complete = vi.fn();
    render(
      <NextIntlClientProvider locale="zh" messages={toMessages(zh)} timeZone="UTC">
        <BirthForm
          initial={{ ...input, timeSource: 'rectified', rectificationConfidence: 0.4 }}
          onComplete={complete}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    await screen.findByRole('button', { name: zh['rectification.start'] });
    fireEvent.click(screen.getByRole('button', { name: zh['rectification.start'] }));
    await vi.waitFor(() =>
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({ timeSource: 'rectified', rectificationConfidence: 0.4 }),
        '',
        'self',
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.back'] }));
    fireEvent.change(screen.getByLabelText(zh['form.birth.time'], { exact: true }), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    await screen.findByRole('button', { name: zh['rectification.start'] });
    fireEvent.click(screen.getByRole('button', { name: zh['rectification.start'] }));
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
    expect(complete.mock.calls[1]![0]).toMatchObject({
      hour: 10,
      timeSource: undefined,
      rectificationConfidence: undefined,
    });
  });
});

describe('calendar switching and date reasons', () => {
  it('ignores the current calendar and clamps to the target month length', () => {
    expect(switchCalendar({ ...input, day: 31 }, 'gregorian')).toBeNull();
    expect(switchCalendar({ ...input, month: 5, day: 31 }, 'lunar')).toMatchObject({
      calendar: 'lunar',
      day: 30,
    });
    expect(
      switchCalendar({ ...input, calendar: 'lunar', month: 6, day: 30 }, 'gregorian'),
    ).toMatchObject({ day: 30 });
    expect(
      switchCalendar({ ...input, calendar: 'lunar', year: 2023, month: 2, day: 30 }, 'gregorian'),
    ).toMatchObject({ day: 28 });
  });
  it('names the specific impossible date', () => {
    expect(dateIssues({ ...input, year: 2023, month: 2, day: 29 })).toEqual([
      { field: 'day', key: 'form.birth.error.notLeap', params: { year: '2023' } },
    ]);
    expect(dateIssues({ ...input, month: 0, day: 0 }).map((i) => i.field)).toEqual([
      'month',
      'day',
    ]);
  });
  it('accepts only in-site return paths', () => {
    expect(safeReturnTo('/today')).toBe('/today');
    expect(safeReturnTo('/zh/today/calendar')).toBe('/today/calendar');
    expect(safeReturnTo('//evil.example')).toBeNull();
    expect(safeReturnTo('https://evil.example')).toBeNull();
    expect(safeReturnTo('/\\evil.example')).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
  });
});

describe('age check, draft and history', () => {
  const zhShow = (ui: React.ReactNode) =>
    render(
      <NextIntlClientProvider locale="zh" messages={toMessages(zh)} timeZone="UTC">
        {ui}
      </NextIntlClientProvider>,
    );
  const fillDate = (year: string) => {
    fireEvent.change(screen.getByLabelText(zh['form.birth.year']), { target: { value: year } });
    fireEvent.change(screen.getByLabelText(zh['form.birth.month']), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(zh['form.birth.day']), { target: { value: '15' } });
    fireEvent.click(screen.getByLabelText(zh['form.birth.timeUnknown']));
  };
  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });
  it('asks about an under-13 birthday and continues as someone else without locking', async () => {
    const { blockAgeAction, createReadingAction } = await import('../app/readings/actions');
    vi.mocked(createReadingAction).mockClear();
    zhShow(<BirthForm />);
    fillDate('2020');
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.ageCheck.other'] }));
    expect(blockAgeAction).not.toHaveBeenCalled();
    await screen.findByLabelText(zh['form.birth.city']);
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.submit'] }));
    await vi.waitFor(() => expect(createReadingAction).toHaveBeenCalled());
    // Someone else's chart is marked for the server and never adopted as the user's profile.
    expect(vi.mocked(createReadingAction).mock.calls[0]).toEqual([
      expect.objectContaining({ subject: 'other', birth: expect.objectContaining({ year: 2020 }) }),
      { saveAsSelf: false },
    ]);
    expect(screen.queryByText(zh['form.birth.error.underThirteen'])).toBeNull();
  });
  it('locks for the user\'s own under-13 birthday and only returns to the form on "I made a mistake"', async () => {
    const { blockAgeAction } = await import('../app/readings/actions');
    vi.mocked(blockAgeAction).mockClear();
    vi.mocked(blockAgeAction).mockResolvedValue(undefined);
    zhShow(<BirthForm />);
    fillDate('2020');
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.ageCheck.fix'] }));
    expect(blockAgeAction).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(zh['form.birth.city'])).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.ageCheck.self'] }));
    expect(blockAgeAction).toHaveBeenCalledOnce();
  });
  it('keeps the profile editor for the user only: "someone else" explains instead of saving', async () => {
    const { blockAgeAction, upsertProfileAction } = await import('../app/readings/actions');
    vi.mocked(blockAgeAction).mockClear();
    zhShow(<BirthForm profileMode />);
    fillDate('2020');
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    fireEvent.click(await screen.findByRole('button', { name: zh['form.birth.ageCheck.other'] }));
    await screen.findByText(zh['form.birth.error.underThirteen']);
    expect(screen.queryByLabelText(zh['form.birth.city'])).toBeNull();
    expect(blockAgeAction).not.toHaveBeenCalled();
    expect(upsertProfileAction).not.toHaveBeenCalled();
  });
  it('treats a saved non-self profile as someone else without asking', async () => {
    zhShow(<BirthForm initial={{ ...input, year: 2020, relation: 'family' }} signedIn />);
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    await screen.findByLabelText(zh['form.birth.city']);
    expect(screen.queryByRole('button', { name: zh['form.birth.ageCheck.self'] })).toBeNull();
  });
  it('records step two in history and restores the session draft after a reload', async () => {
    const view = zhShow(<BirthForm />);
    fillDate('1990');
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.next'] }));
    await screen.findByLabelText(zh['form.birth.city']);
    expect(window.location.search).toBe('?step=2');
    expect(sessionStorage.getItem('tianji.draft.bazi')).toContain('1990');
    view.unmount();
    zhShow(<BirthForm />);
    await screen.findByLabelText(zh['form.birth.city']);
    fireEvent.click(screen.getByRole('button', { name: zh['form.birth.back'] }));
    await vi.waitFor(() => expect(window.location.search).toBe(''));
    await screen.findByDisplayValue('1990');
  });
});
