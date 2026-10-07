import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { SessionManager } from '../account/session';
import { setCurrentOwner } from '../account/scope';
import { refreshEngagement } from './service';
export const engagementTask = 'tianji-daily-refresh';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
/** Execute the same offline refresh in the OS task and simulator diagnostics. */
export async function runEngagementBackground() {
  try {
    // Headless processes restore only local identity; no refresh-token/network call is needed.
    const session = new SessionManager();
    await session.restore();
    setCurrentOwner(session.session?.userId ?? null);
    await refreshEngagement();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}
TaskManager.defineTask(engagementTask, runEngagementBackground);
/** OS runs opportunistically; precomputed midnight timelines cover delayed refreshes. */
export async function registerEngagementBackground() {
  // DESIGN-GAP: A 60-minute minimum interval is an OS hint, not an exact midnight alarm.
  // iOS simulator cannot exercise BGTaskScheduler; deterministic task execution is tested separately.
  if (!(await TaskManager.isTaskRegisteredAsync(engagementTask)))
    await BackgroundTask.registerTaskAsync(engagementTask, { minimumInterval: 60 });
}
