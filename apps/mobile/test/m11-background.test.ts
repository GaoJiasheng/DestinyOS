import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import {
  runEngagementBackground,
  registerEngagementBackground,
  engagementTask,
} from '../lib/engagement/background';
import { refreshEngagement } from '../lib/engagement/service';
import { currentOwner } from '../lib/account/scope';
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));
jest.mock('expo-background-task', () => ({
  registerTaskAsync: jest.fn(async () => {}),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));
jest.mock('../lib/account/session', () => ({
  SessionManager: class {
    session = { userId: 'restored-user' };
    restore = async () => {};
  },
}));
jest.mock('../lib/engagement/service', () => ({ refreshEngagement: jest.fn(async () => {}) }));
it('defines at module scope, restores local identity and registers only once', async () => {
  expect(TaskManager.defineTask).toHaveBeenCalledWith(engagementTask, runEngagementBackground);
  await registerEngagementBackground();
  expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(engagementTask, {
    minimumInterval: 60,
  });
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
  jest.mocked(BackgroundTask.registerTaskAsync).mockClear();
  await registerEngagementBackground();
  expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  expect(await runEngagementBackground()).toBe(1);
  expect(currentOwner()).toBe('restored-user');
  expect(refreshEngagement).toHaveBeenCalledWith();
});
it('returns failure for a locked/unavailable encrypted store', async () => {
  jest.mocked(refreshEngagement).mockRejectedValueOnce(new Error('locked'));
  expect(await runEngagementBackground()).toBe(2);
});
