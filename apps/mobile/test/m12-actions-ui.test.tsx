import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ReportActions } from '../components/report/report-actions';
import { usePreferences } from '../lib/preferences';
import { useNetworkDiagnostic } from '../lib/network';
import { fixtureReport } from '../lib/diagnostics/fixture';
import { parseNativeChart, type NativeReading } from '../lib/reports/readings';
import type { ReportActions as Operations } from '../lib/reports/actions';
import { shareExport } from '../lib/reports/actions';
import type { PublicShare } from '@tianji/ui-core/share-projection';
import { useAccount } from '../lib/account/controller';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../lib/account/controller', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  return { useAccount: create(() => ({ session: null })) };
});
let mockProjection: PublicShare | undefined;
jest.mock('../components/report/share-card', () => ({
  ShareCard: ({ value }: { value: PublicShare }) => {
    mockProjection = value;
    return null;
  },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => {}) }));
jest.mock('../lib/reports/actions', () => ({
  ...jest.requireActual<typeof import('../lib/reports/actions')>('../lib/reports/actions'),
  shareExport: jest.fn(async () => {}),
}));
const fixture = fixtureReport('bazi', 'en');
const reading: NativeReading = {
  chart: parseNativeChart('bazi', fixture.chart),
  report: fixture.report,
  warnings: [],
  stale: false,
  record: {
    id: 'reading-1',
    userId: null,
    data: null,
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    deletedAt: null,
  },
};
let actions: Operations;
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'en' });
  useNetworkDiagnostic.setState({ offline: false });
  useAccount.setState({ session: null });
  actions = {
    history: jest.fn(),
    send: jest.fn(),
    deleteChat: jest.fn(),
    export: jest.fn(async () => [
      { url: '/page1', filename: 'report1.png' },
      { url: '/page2', filename: 'report2.png' },
    ]),
    link: jest.fn(async () => 'https://tianji.gavin.pub/s/1234567890123456789012'),
    download: jest.fn(),
  };
});
it('offline keeps Skia sharing available but disables chat, export and public link generation', () => {
  useNetworkDiagnostic.setState({ offline: true });
  render(<ReportActions reading={reading} actions={actions} diagnostic />);
  expect(screen.getByTestId('report-chat')).toBeDisabled();
  expect(screen.getByTestId('report-export')).toBeDisabled();
  expect(screen.getByTestId('report-share')).not.toBeDisabled();
  fireEvent.press(screen.getByTestId('report-share'));
  expect(screen.getByTestId('share-link')).toBeDisabled();
  expect(mockProjection?.revealLevel).toBe(0);
  expect(mockProjection?.diagram).toBeUndefined();
  expect(mockProjection?.sections).toBeUndefined();
});
it('visibility uses the shared public whitelist, and links receive the explicit reveal level', async () => {
  render(<ReportActions reading={reading} actions={actions} diagnostic />);
  fireEvent.press(screen.getByTestId('report-share'));
  fireEvent.press(screen.getByTestId('share-level-1'));
  expect(mockProjection?.diagram).toBeDefined();
  expect(mockProjection).not.toHaveProperty('birth');
  expect(mockProjection).not.toHaveProperty('inputSnapshot');
  fireEvent.press(screen.getByTestId('share-level-2'));
  expect(mockProjection?.sections).toBeDefined();
  fireEvent.press(screen.getByTestId('share-link'));
  await waitFor(() =>
    expect(actions.link).toHaveBeenCalledWith('reading-1', {
      locale: 'en',
      revealLevel: 2,
      template: 'quote',
    }),
  );
  await waitFor(() => expect(screen.getByTestId('share-link-url')).toBeTruthy());
});
it('A4 images call the Web export contract then OS sharing, retaining per-page actions', async () => {
  render(<ReportActions reading={reading} actions={actions} diagnostic />);
  fireEvent.press(screen.getByTestId('report-export'));
  fireEvent.press(screen.getByTestId('export-theme-light'));
  fireEvent.press(screen.getByTestId('export-png'));
  await waitFor(() =>
    expect(actions.export).toHaveBeenCalledWith('reading-1', {
      locale: 'en',
      theme: 'light',
      format: 'png',
    }),
  );
  await waitFor(() => expect(shareExport).toHaveBeenCalled());
  fireEvent.press(screen.getByTestId('export-page-1'));
  await waitFor(() =>
    expect(shareExport).toHaveBeenLastCalledWith(
      actions,
      { url: '/page2', filename: 'report2.png' },
      'Download export',
    ),
  );
});
it('guests receive the sign-in path without cloud uploads', () => {
  render(<ReportActions reading={reading} actions={actions} />);
  fireEvent.press(screen.getByTestId('report-export'));
  expect(screen.getByTestId('export-pdf')).toBeDisabled();
  expect(actions.export).not.toHaveBeenCalled();
});
