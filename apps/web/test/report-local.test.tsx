// @vitest-environment jsdom
import type { ComponentProps, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { toMessages } from '../i18n/catalog';
import en from '../messages/en.json';

const storage = vi.hoisted(() => ({
  readAnonymous: vi.fn(),
  updateAnonymous: vi.fn(),
  clearAnonymous: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  translateAnonymousReportAction: vi.fn(),
  importAnonymousDataAction: vi.fn(),
}));
vi.mock('../lib/anonymous-storage', () => storage);
vi.mock('../app/readings/actions', () => actions);
vi.mock('../i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
  usePathname: () => '/bazi',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// The full layout is covered elsewhere; here only the reading handed to it matters.
vi.mock('../components/report/report-layout', () => ({
  ReportLayout: (props: { reading: { report: { locale: string } }; birthDetails?: string }) => (
    <p>
      layout:{props.reading.report.locale}:{props.birthDetails}
    </p>
  ),
}));
import { LocalReport } from '../components/report/local-report';
import { AnonymousImport } from '../components/report/anonymous-import';

const wrap = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={toMessages(en)} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
const reading = {
  id: 'l1',
  system: 'bazi',
  report: { locale: 'zh' },
  request: {
    birth: { year: 1990, month: 6, day: 15, hour: 9, minute: 5, place: { name: 'X', tz: 'UTC' } },
  },
};

it('falls back to the original language when translation fails, without a storage error', async () => {
  storage.readAnonymous.mockResolvedValue({ readings: [reading] });
  actions.translateAnonymousReportAction.mockResolvedValue({
    ok: false,
    error: { code: 'E_RATE_LIMITED' },
  });
  wrap(<LocalReport id="l1" system="bazi" />);
  expect(await screen.findByText(en['report.localTranslateFailed'])).toBeTruthy();
  expect(screen.getByText(/layout:zh:1990-6-15 · 09:05/)).toBeTruthy();
  expect(screen.queryByText(en['report.storageError'])).toBeNull();
});

it('offers a new reading and the history page when the device has no such report', async () => {
  storage.readAnonymous.mockResolvedValue({ readings: [] });
  wrap(<LocalReport id="missing" system="bazi" />);
  expect(await screen.findByText(en['report.localMissing'])).toBeTruthy();
  expect(
    screen.getByRole('link', { name: en['report.localMissingRecalc'] }).getAttribute('href'),
  ).toBe('/bazi');
  expect(
    screen.getByRole('link', { name: en['report.localMissingHistory'] }).getAttribute('href'),
  ).toBe('/me/history');
});

it('does not offer the import again in this session after "later"', async () => {
  document.cookie = 'anon_import=1; Path=/';
  storage.readAnonymous.mockResolvedValue({ readings: [reading] });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ user: { id: 'u1' } })),
  );
  const first = wrap(<AnonymousImport />);
  fireEvent.click(await screen.findByRole('button', { name: en['report.import.later'] }));
  first.unmount();
  wrap(<AnonymousImport />);
  await waitFor(() => expect(storage.readAnonymous).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: en['report.import.later'] })).toBeNull();
  document.cookie = 'anon_import=; Max-Age=0; Path=/';
});
