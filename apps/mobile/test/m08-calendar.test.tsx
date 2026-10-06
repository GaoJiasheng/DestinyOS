import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CalendarScreen } from '../components/daily/calendar-screen';
import { NotificationHint } from '../components/daily/notification-hint';
import { computeCalendarYear } from '@tianji/engine/calendar';
import { monthDays } from '../lib/daily/service';
import { usePreferences } from '../lib/preferences';
import { SettingsSchema as MockSettingsSchema } from '../lib/data/models';
import { getPermissionsAsync } from 'expo-notifications';
const mockPush = jest.fn(),
  mockUpdate = jest.fn();
let mockActive: { id: string; data: { birth: { timeUnknown: boolean } } } | null = {
  id: 'a',
  data: { birth: { timeUnknown: true } },
};
let mockDismissed = false;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    active: mockActive,
    settings: MockSettingsSchema.parse({
      tz: 'America/New_York',
      dailyNotificationHintDismissed: mockDismissed,
    }),
    updateSettings: mockUpdate,
  }),
}));
jest.mock('../lib/daily/service', () => ({ monthDays: jest.fn(), todayIn: () => '2026-10-07' }));
jest.mock('@tianji/engine/calendar', () => ({ computeCalendarYear: jest.fn() }));
jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockActive = { id: 'a', data: { birth: { timeUnknown: true } } };
  mockDismissed = false;
  usePreferences.setState({ locale: 'zh', theme: 'auto' });
  jest.mocked(monthDays).mockReturnValue([
    {
      date: '2026-10-04',
      overall: 75,
      scores: { career: 75, wealth: 75, love: 75, health: 75, social: 75, overall: 75 },
    },
  ]);
  jest.mocked(computeCalendarYear).mockReturnValue([]);
});
afterEach(() => jest.useRealTimers());
it('keeps explicit timezone, opens exact dates and changes month/year at the boundary', async () => {
  render(<CalendarScreen />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(200);
  });
  fireEvent.press(screen.getByTestId('calendar-day-2026-10-04'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/today', params: { date: '2026-10-04' } });
  expect(monthDays).toHaveBeenCalledWith(mockActive, '2026-10', 'America/New_York', 'zh');
  fireEvent.press(screen.getByTestId('calendar-prev'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(200);
  });
  expect(monthDays).toHaveBeenLastCalledWith(mockActive, '2026-09', 'America/New_York', 'zh');
});
it('offers English missing profile and retries engine failures without stale cells', async () => {
  usePreferences.setState({ locale: 'en' });
  mockActive = null;
  const empty = render(<CalendarScreen />);
  expect(screen.queryByTestId('calendar-grid')).toBeNull();
  empty.unmount();
  mockActive = { id: 'a', data: { birth: { timeUnknown: true } } };
  jest.mocked(monthDays).mockImplementationOnce(() => {
    throw new Error('engine');
  });
  render(<CalendarScreen />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(200);
  });
  expect(screen.queryByTestId('calendar-grid')).toBeNull();
  fireEvent.press(screen.getByText('Try again'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(200);
  });
  expect(screen.getByTestId('calendar-grid')).toBeTruthy();
});
it('reads denied permission without requesting it and persists one-time hint dismissal', async () => {
  jest
    .mocked(getPermissionsAsync)
    .mockResolvedValue({ status: 'denied' } as Awaited<ReturnType<typeof getPermissionsAsync>>);
  mockUpdate.mockResolvedValue(undefined);
  const view = render(<NotificationHint />);
  await waitFor(() => expect(screen.getByTestId('daily-notifications')).toBeTruthy());
  fireEvent.press(screen.getByText('关闭'));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith({ dailyNotificationHintDismissed: true }),
  );
  mockDismissed = true;
  view.rerender(<NotificationHint />);
  expect(screen.queryByTestId('daily-notifications')).toBeNull();
});
