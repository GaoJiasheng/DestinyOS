import * as Native from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { JournalScreen } from '../components/daily/journal-screen';
import { SettingsSchema as MockSettingsSchema } from '../lib/data/models';
import { monthDays, profileJournal } from '../lib/daily/service';
import { usePreferences } from '../lib/preferences';
const mockPush = jest.fn();
const mockActive = { id: 'synthetic', data: { birth: { timeUnknown: true } } };
jest.mock('expo-router/react-navigation', () => ({ useIsFocused: () => true }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    active: mockActive,
    settings: MockSettingsSchema.parse({ tz: 'UTC' }),
  }),
}));
jest.mock('../lib/daily/service', () => ({
  profileJournal: jest.fn(),
  monthDays: jest.fn(),
  todayIn: () => '2026-10-07',
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({
    width: 390,
    height: 844,
    scale: 3,
    fontScale: 3.571,
  });
  jest.mocked(profileJournal).mockResolvedValue([]);
  jest.mocked(monthDays).mockReturnValue([
    {
      date: '2026-10-04',
      overall: 75,
      scores: { career: 75, wealth: 75, love: 75, health: 75, social: 75, overall: 75 },
    },
  ]);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it.each(['zh', 'en'] as const)(
  'retains unrecorded dates and month/list selection at maximum text size in %s',
  async (locale) => {
    usePreferences.setState({ locale });
    render(<JournalScreen />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByTestId('journal-mode-month').props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('2026-10-04')).toBeTruthy();
    fireEvent.press(screen.getByTestId('journal-day-2026-10-04'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/today', params: { date: '2026-10-04' } });
    fireEvent.press(screen.getByTestId('journal-mode-list'));
    expect(screen.queryByTestId('journal-grid')).toBeNull();
    expect(screen.getByTestId('journal-mode-list').props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByTestId('journal-mode-month'));
    expect(screen.getByTestId('journal-day-2026-10-04')).toBeTruthy();
  },
);
