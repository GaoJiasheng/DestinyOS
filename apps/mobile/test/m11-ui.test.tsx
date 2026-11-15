import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NotificationSettings } from '../components/notification-settings';
import { SettingsSchema } from '../lib/data/models';
import { useProfiles } from '../lib/profiles';
import { usePreferences } from '../lib/preferences';
import { refreshEngagement } from '../lib/engagement/service';
import { requestNotificationPermission } from '../lib/notifications';
jest.mock('../lib/profiles', () => ({ useProfiles: jest.fn() }));
jest.mock('../lib/engagement/service', () => ({ refreshEngagement: jest.fn(async () => {}) }));
jest.mock('../lib/notifications', () => ({
  requestNotificationPermission: jest.fn(async () => false),
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
const updateSettings = jest.fn(async () => {});
beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ locale: 'zh' });
  jest.mocked(useProfiles).mockReturnValue({
    settings: SettingsSchema.parse({ onboardingVersion: 1 }),
    active: null,
    updateSettings,
    profiles: [],
    loading: false,
    error: false,
    reload: async () => {},
    save: async () => {},
    select: async () => {},
    setDefault: jest.fn(async () => {}),
    remove: async () => {},
  });
});
it('shows defaults and updates special toggle, theme and local reminder time', async () => {
  render(<NotificationSettings />);
  expect(screen.getByTestId('push-enabled').props.value).toBe(true);
  expect(screen.getByText(/08:00/)).toBeTruthy();
  fireEvent(screen.getByTestId('push-special'), 'valueChange', false);
  await screen.findByTestId('push-saved');
  expect(updateSettings).toHaveBeenCalledWith({ specialDayReminders: false });
  fireEvent.press(screen.getByTestId('widget-theme-west'));
  await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ widgetTheme: 'west' }));
  await waitFor(() => expect(screen.getByTestId('push-refresh')).toBeEnabled());
  const date = new Date();
  date.setHours(9, 30);
  expect(screen.queryByTestId('push-time')).toBeNull();
  fireEvent.press(screen.getByTestId('push-time-open'));
  const calls = updateSettings.mock.calls.length;
  fireEvent(screen.getByTestId('push-time'), 'change', { type: 'set' }, date);
  // Spinner ticks only update the draft; saving waits for an explicit confirmation.
  expect(updateSettings).toHaveBeenCalledTimes(calls);
  fireEvent.press(screen.getByTestId('push-time-confirm'));
  await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ dailyPushTime: '09:30' }));
  expect(screen.queryByTestId('push-time')).toBeNull();
  expect(refreshEngagement).toHaveBeenCalled();
});
it('localizes permission denial and keeps reminders off until the OS allows them', async () => {
  usePreferences.setState({ locale: 'en' });
  render(<NotificationSettings />);
  fireEvent(screen.getByTestId('push-enabled'), 'valueChange', true);
  await screen.findByTestId('push-denied');
  expect(requestNotificationPermission).toHaveBeenCalledWith('Daily reminders');
  expect(updateSettings).toHaveBeenCalledWith({ dailyPushEnabled: false });
  expect(screen.getByTestId('push-denied')).toHaveTextContent(/aren't allowed/);
  expect(screen.getByText('Widget theme')).toBeTruthy();
});
it('reports scheduling errors and offers a retry', async () => {
  jest.mocked(refreshEngagement).mockRejectedValueOnce(new Error('error'));
  render(<NotificationSettings />);
  fireEvent.press(screen.getByTestId('push-refresh'));
  await screen.findByTestId('push-error');
  fireEvent.press(screen.getByTestId('push-refresh'));
  await screen.findByTestId('push-saved');
});
