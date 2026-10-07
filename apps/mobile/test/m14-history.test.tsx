import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { HistoryScreen } from '../components/history-screen';
import { usePreferences } from '../lib/preferences';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../lib/profiles', () => ({ useProfiles: () => ({ active: { id: 'selected' } }) }));
jest.mock('../lib/data/store', () => ({
  getLocalStore: async () => ({
    readings: {
      list: async () =>
        Array.from({ length: 500 }, (_, i) => ({
          id: String(i),
          createdAt: '2026-10-07',
          data: { system: 'bazi', profileId: 'selected', inputSnapshot: {} },
        })),
    },
  }),
}));
it('windows 500 variable-height report rows and preserves report navigation', async () => {
  usePreferences.setState({ locale: 'en' });
  render(<HistoryScreen />);
  await waitFor(() => expect(screen.getByTestId('history-0')).toBeTruthy(), { timeout: 10000 });
  expect(screen.queryByTestId('history-499')).toBeNull();
  fireEvent.press(screen.getByTestId('history-0'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/[system]/r/[id]',
    params: { system: 'bazi', id: '0' },
  });
});
