import * as Notifications from 'expo-notifications';
import { refreshEngagement, cancelReminders } from '../lib/engagement/service';
import { planEngagement } from '../lib/engagement/planner';
import { clearWidgetSnapshot, writeWidgetSnapshot } from '../lib/engagement/widget-storage';
import { SettingsSchema } from '../lib/data/models';
import { setCurrentOwner } from '../lib/account/scope';
jest.mock('../lib/engagement/widget-storage', () => ({
  clearWidgetSnapshot: jest.fn(async () => {}),
  writeWidgetSnapshot: jest.fn(async () => {}),
}));
jest.mock('../lib/engagement/planner', () => ({ planEngagement: jest.fn() }));
jest.mock('../lib/data/store', () => ({}));
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => [
    { identifier: 'tianji:daily:old' },
    { identifier: 'tianji:announcement' },
  ]),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'scheduled'),
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
const context = { settings: SettingsSchema.parse({ onboardingVersion: 1 }), profile: null };
const snapshot = { version: 1 as const, locale: 'zh' as const, stale: 'stale', days: [] };
beforeEach(() => {
  jest.clearAllMocks();
  setCurrentOwner(null);
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);
  jest.mocked(planEngagement).mockReturnValue({
    snapshot,
    reminders: [
      {
        id: 'tianji:daily:2026-10-08',
        at: Date.parse('2026-10-08T08:00:00Z'),
        title: 'Daily',
        body: 'Guide',
        route: '/me/birth',
      },
    ],
  });
});
it('replaces owned schedules and leaves unrelated announcements alone on repeated refresh', async () => {
  await refreshEngagement(context);
  await refreshEngagement(context);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: 'tianji:daily:2026-10-08',
      content: expect.objectContaining({ data: { route: '/me/birth' } }),
      trigger: expect.objectContaining({ type: 'date' }),
    }),
  );
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
    'tianji:announcement',
  );
  expect(writeWidgetSnapshot).toHaveBeenCalledWith(snapshot);
});
it('permission denial still publishes widgets, but never schedules or asks again', async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false } as Notifications.NotificationPermissionsStatus);
  await refreshEngagement(context);
  expect(writeWidgetSnapshot).toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
it('gates minors and incomplete onboarding and clears prior snapshots', async () => {
  await refreshEngagement({ ...context, settings: { ...context.settings, ageBlocked: true } });
  expect(clearWidgetSnapshot).toHaveBeenCalled();
  expect(planEngagement).not.toHaveBeenCalled();
  await refreshEngagement({ ...context, settings: { ...context.settings, onboardingVersion: 0 } });
  expect(writeWidgetSnapshot).not.toHaveBeenCalled();
});
it('rolls back partial schedules on OS error and can retry', async () => {
  jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValueOnce(new Error('OS error'));
  await expect(refreshEngagement(context)).rejects.toThrow('OS error');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  await expect(refreshEngagement(context)).resolves.toBeUndefined();
});
it('drops queued work after an identity switch', async () => {
  const pending = refreshEngagement(context);
  setCurrentOwner('another');
  await pending;
  expect(writeWidgetSnapshot).not.toHaveBeenCalled();
  await cancelReminders();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('tianji:daily:old');
});
