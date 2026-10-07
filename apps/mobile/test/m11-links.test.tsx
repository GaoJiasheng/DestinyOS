import { render, waitFor } from '@testing-library/react-native';
import { EngagementBootstrap } from '../components/engagement-bootstrap';
import * as Notifications from 'expo-notifications';
import { SettingsSchema } from '../lib/data/models';
const mockSettings = SettingsSchema.parse({});
const mockPush = jest.fn();
let mockResponse: ((response: Notifications.NotificationResponse) => void) | undefined;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../lib/profiles', () => ({
  useProfiles: () => ({
    loading: true,
    error: false,
    active: null,
    settings: mockSettings,
  }),
}));
jest.mock('../lib/engagement/service', () => ({
  refreshEngagement: jest.fn(),
  clearEngagement: jest.fn(async () => {}),
}));
jest.mock('../lib/engagement/background', () => ({ registerEngagementBackground: jest.fn() }));
jest.mock('../lib/engagement/planner', () => ({
  notificationRoute: (route: unknown) =>
    route === '/today' || route === '/me/birth' ? route : null,
}));
jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(async () => ({
    notification: {
      date: 0,
      request: { identifier: 'cold', content: { data: { route: '/me/birth' } } },
    },
  })),
  addNotificationResponseReceivedListener: jest.fn((callback) => {
    mockResponse = callback;
    return { remove: jest.fn() };
  }),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
}));
function response(id: string, route: string) {
  return {
    actionIdentifier: 'default',
    notification: {
      date: 0,
      request: {
        identifier: id,
        trigger: null,
        content: {
          data: { route },
          title: null,
          subtitle: null,
          body: null,
          categoryIdentifier: null,
          sound: null,
          launchImageName: null,
          badge: null,
          attachments: [],
          threadIdentifier: null,
        },
      },
    },
  } satisfies Notifications.NotificationResponse;
}
it('opens the cold guide tap, deduplicates warm taps and rejects arbitrary destinations', async () => {
  render(<EngagementBootstrap />);
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/me/birth'));
  mockResponse?.(response('warm', '/today'));
  expect(mockPush).toHaveBeenCalledWith('/today');
  mockResponse?.(response('warm', '/today'));
  mockResponse?.(response('external', 'https://evil.test'));
  expect(mockPush).toHaveBeenCalledTimes(2);
  expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(2);
});
