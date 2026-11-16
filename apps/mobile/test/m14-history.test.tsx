import { AccessibilityInfo, Alert, FlatList } from 'react-native';
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
describe('deleting from history', () => {
  const mockDelete = jest.fn();
  let a11y = { reduced: false, screenReader: false };
  beforeEach(() => {
    mockDelete.mockReset().mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(a11y.screenReader);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(a11y.reduced);
    mockListBySystem.mockResolvedValue(rows.slice(0, 2));
    jest.requireMock('../lib/data/store').getLocalStore = async () => ({
      readings: { listBySystem: mockListBySystem, delete: mockDelete },
    });
  });
  const confirmDelete = async () => {
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as {
      onPress?: () => void;
      style?: string;
    }[];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());
  };
  it('swipe action asks first, then removes the row from the list', async () => {
    render(<HistoryScreen />);
    await screen.findByTestId('history-0');
    fireEvent.press(screen.getByTestId('history-delete-0'));
    expect(mockDelete).not.toHaveBeenCalled();
    await confirmDelete();
    expect(mockDelete).toHaveBeenCalledWith('0');
    await waitFor(() => expect(screen.queryByTestId('history-0')).toBeNull());
    expect(screen.getByTestId('history-1')).toBeTruthy();
  });
  it('exposes delete as an accessibility action on the row', async () => {
    render(<HistoryScreen />);
    const row = await screen.findByTestId('history-1');
    expect(row.props.accessibilityActions).toEqual([expect.objectContaining({ name: 'delete' })]);
    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    await confirmDelete();
    expect(mockDelete).toHaveBeenCalledWith('1');
  });
  it('keeps the row and shows an error when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('x'));
    render(<HistoryScreen />);
    await screen.findByTestId('history-0');
    fireEvent.press(screen.getByTestId('history-delete-0'));
    await confirmDelete();
    await screen.findByTestId('history-delete-error');
    expect(screen.getByTestId('history-0')).toBeTruthy();
  });
  it('shows a plain delete button instead of a swipe for screen readers', async () => {
    a11y = { reduced: false, screenReader: true };
    render(<HistoryScreen />);
    await screen.findByTestId('history-0');
    await waitFor(() =>
      expect(screen.getByTestId('history-delete-0').props.accessibilityLabel).toContain('BaZi'),
    );
    a11y = { reduced: false, screenReader: false };
  });
});
