import { FlatList } from 'react-native';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { HistoryScreen } from '../components/history-screen';
import { usePreferences } from '../lib/preferences';
const mockPush = jest.fn();
const mockListBySystem = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
// expo-crypto's real module needs native classes that the jest environment does not provide.
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000009' }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    active: { id: 'selected' },
    profiles: [{ id: 'selected', data: { name: 'Mei' } }],
    settings: { tz: 'Asia/Shanghai' },
  }),
}));
jest.mock('../lib/data/store', () => ({
  getLocalStore: async () => ({ readings: { listBySystem: mockListBySystem } }),
}));
const rows = Array.from({ length: 120 }, (_, i) => ({
  id: String(i),
  // 23:30 UTC is already the next morning in Shanghai.
  createdAt: '2026-10-07T23:30:00.000Z',
  data: { system: 'bazi', profileId: 'selected', inputSnapshot: {} },
}));
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'en' });
  mockListBySystem.mockImplementation(async (_filter: unknown, limit: number, offset: number) =>
    rows.slice(offset, offset + limit),
  );
});
it('pages real reports from SQL without daily records and keeps report navigation', async () => {
  render(<HistoryScreen />);
  await waitFor(() => expect(screen.getByTestId('history-0')).toBeTruthy());
  expect(mockListBySystem).toHaveBeenCalledWith(
    { except: ['daily'], profileId: 'selected' },
    50,
    0,
  );
  expect(screen.getByTestId('history-0').props.accessibilityLabel).toBe('BaZi · Oct 8, 2026 · Mei');
  await act(async () => {
    screen.UNSAFE_getByType(FlatList).props.onEndReached();
  });
  expect(mockListBySystem).toHaveBeenLastCalledWith(
    { except: ['daily'], profileId: 'selected' },
    50,
    50,
  );
  expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(100);
  fireEvent.press(screen.getByTestId('history-0'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/[system]/r/[id]',
    params: { system: 'bazi', id: '0' },
  });
});
it('shows the empty state with a way to start a reading', async () => {
  mockListBySystem.mockResolvedValue([]);
  render(<HistoryScreen />);
  await screen.findByTestId('history-empty');
  fireEvent.press(screen.getByTestId('history-start'));
  expect(mockPush).toHaveBeenCalledWith('/reading');
});
