// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CitySearch } from '../components/forms/city-search';
import { BirthPlaceFields } from '../components/forms/birth-place-fields';
import { toMessages } from '../i18n/catalog';
import type { BirthInput } from '@tianji/shared';
import zh from '../messages/zh.json';
import en from '../messages/en.json';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const city = {
  name: 'Singapore',
  country: 'SG',
  admin: 'SG',
  lat: 1.29,
  lng: 103.85,
  tz: 'Asia/Singapore',
};

for (const [locale, catalog] of [
  ['zh', zh],
  ['en', en],
] as const) {
  it(`${locale}: city search keeps keyboard selection and localized empty/error states`, async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ ok: true, data: [city] }));
    vi.stubGlobal('fetch', fetcher);
    const select = vi.fn();
    render(
      <NextIntlClientProvider locale={locale} messages={toMessages(catalog)} timeZone="UTC">
        <CitySearch onSelect={select} />
      </NextIntlClientProvider>,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Singapore' } });
    await screen.findByRole('option');
    expect(fetcher.mock.calls[0]![0]).toBe(`/api/v1/geo/search?q=Singapore&locale=${locale}`);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(select).toHaveBeenCalledWith({
      name: city.name,
      lat: city.lat,
      lng: city.lng,
      tz: city.tz,
    });
    fetcher.mockImplementation(async () => Response.json({ ok: true, data: [] }));
    fireEvent.change(input, { target: { value: 'no-match' } });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(catalog['form.birth.city.empty']),
    );
    fetcher.mockRejectedValue(new Error('offline'));
    fireEvent.change(input, { target: { value: 'offline' } });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(catalog['form.birth.city.error']),
    );
  });
}

it('aborts pending city transport on unmount', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetcher);
  const view = render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)} timeZone="UTC">
      <CitySearch onSelect={vi.fn()} />
    </NextIntlClientProvider>,
  );
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Singapore' } });
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  const signal = fetcher.mock.calls[0]![1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
});

it('retains timezone success, invalid-input and malformed-JSON error mapping', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ ok: true, data: { tz: city.tz } }));
  vi.stubGlobal('fetch', fetcher);
  const birth: BirthInput = {
    calendar: 'gregorian',
    year: 1990,
    month: 5,
    day: 15,
    timeUnknown: true,
    gender: 'unspecified',
    place: { name: city.name, lat: city.lat, lng: city.lng, tz: city.tz },
  };
  const setPlace = vi.fn();
  const setError = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)} timeZone="UTC">
      <BirthPlaceFields
        birth={birth}
        change={vi.fn()}
        manual
        setManual={vi.fn()}
        setPlace={setPlace}
        setError={setError}
        preview={null}
        solar={false}
      />
    </NextIntlClientProvider>,
  );
  const button = screen.getByRole('button', { name: en['form.birth.resolveTz'] });
  fireEvent.click(button);
  await waitFor(() => expect(setPlace).toHaveBeenCalledWith({ tz: city.tz }));
  fetcher.mockImplementation(async () =>
    Response.json(
      { ok: false, error: { code: 'E_VALIDATION', message: 'Invalid coordinates' } },
      { status: 400 },
    ),
  );
  fireEvent.click(button);
  await waitFor(() => expect(setError).toHaveBeenLastCalledWith('engine.errors.E_INVALID_INPUT'));
  fetcher.mockImplementation(async () => new Response('malformed'));
  fireEvent.click(button);
  await waitFor(() => expect(setError).toHaveBeenLastCalledWith('report.error.E_INTERNAL'));
});
