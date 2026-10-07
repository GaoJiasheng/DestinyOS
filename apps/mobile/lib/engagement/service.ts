import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getLocalStore } from '../data/store';
import { currentOwner } from '../account/scope';
import { SettingsSchema, type Settings, type LocalRecord, type Profile } from '../data/models';
import { getCopy } from '../copy';
import { planEngagement } from './planner';
import { clearWidgetSnapshot, writeWidgetSnapshot } from './widget-storage';

const isReminder = (id: string) =>
  id.startsWith('tianji:daily:') || id.startsWith('tianji:special:');
let flight: Promise<void> = Promise.resolve();
let publishedIdentity: string | undefined;
/** Cancel only DestinyOS daily/special requests, preserving unrelated local announcements. */
export async function cancelReminders() {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of pending)
    if (isReminder(request.identifier))
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
}
/** Clear former identity/profile data before asynchronous account changes or failed computation. */
export async function clearEngagement() {
  publishedIdentity = undefined;
  await cancelReminders();
  await clearWidgetSnapshot();
}
/** Load settings and selected profile exclusively from the current encrypted account scope. */
export async function readEngagementContext() {
  const store = await getLocalStore();
  const [profiles, records] = await Promise.all([store.profiles.list(500), store.settings.list(1)]);
  const settings = records[0]?.data ?? SettingsSchema.parse({});
  return {
    settings,
    profile:
      profiles.find((p) => p.id === settings.activeProfileId) ??
      profiles.find((p) => p.data?.isDefault) ??
      profiles[0] ??
      null,
  };
}
/** Serialize rolling replacements so rapid settings/profile changes cannot interleave schedules. */
export function refreshEngagement(context?: {
  settings: Settings;
  profile: LocalRecord<Profile> | null;
}) {
  const owner = currentOwner();
  const work = flight
    .catch(() => undefined)
    .then(async () => {
      if (owner !== currentOwner()) return;
      const selected = context ?? (await readEngagementContext());
      // Onboarding controls when OS permission is requested. Scheduling never opens a permission dialog.
      if (selected.settings.ageBlocked || selected.settings.onboardingVersion < 1) {
        await clearEngagement();
        return;
      }
      const identity = JSON.stringify([
        owner,
        selected.profile?.id,
        selected.profile?.data?.version,
        selected.settings.locale,
        selected.settings.widgetTheme,
        selected.settings.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      ]);
      // Clear on identity changes before computation. Ordinary rollovers publish once so
      // WidgetKit's reload budget is not spent on an intermediate empty snapshot.
      if (identity !== publishedIdentity) await clearWidgetSnapshot();
      const plan = planEngagement(selected.profile, selected.settings);
      if (owner !== currentOwner()) return;
      await writeWidgetSnapshot(plan.snapshot);
      publishedIdentity = identity;
      await cancelReminders();
      if (Platform.OS === 'android')
        await Notifications.setNotificationChannelAsync('daily', {
          name: getCopy(selected.settings.locale)('mobile.push.title'),
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      const permission = await Notifications.getPermissionsAsync();
      if (
        !permission.granted &&
        permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
      )
        return;
      try {
        for (const reminder of plan.reminders) {
          if (owner !== currentOwner()) {
            await clearEngagement();
            return;
          }
          await Notifications.scheduleNotificationAsync({
            identifier: reminder.id,
            content: {
              title: reminder.title,
              body: reminder.body,
              sound: 'default',
              data: { route: reminder.route },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(reminder.at),
              channelId: 'daily',
            },
          });
        }
      } catch (error) {
        // DESIGN-GAP: Roll back a partial schedule; the foreground settings screen offers a retry.
        await cancelReminders();
        throw error;
      }
    });
  flight = work;
  return work;
}
