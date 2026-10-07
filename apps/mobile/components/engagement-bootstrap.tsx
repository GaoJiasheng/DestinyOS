import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useProfiles } from '../lib/profiles';
import { todayIn } from '../lib/daily/service';
import { usePreferences } from '../lib/preferences';
import { notificationRoute } from '../lib/engagement/planner';
import { refreshEngagement, clearEngagement } from '../lib/engagement/service';
import { registerEngagementBackground } from '../lib/engagement/background';
import { subscribeOwner } from '../lib/account/scope';
/** Refresh on launches, resumes, midnight, profile/locale/settings changes; route warm/cold taps. */
export function EngagementBootstrap() {
  const { active, settings, loading, error } = useProfiles();
  const locale = usePreferences((s) => s.locale);
  const router = useRouter();
  useEffect(() => {
    const handled = new Set<string>();
    const route = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const destination = notificationRoute(response.notification.request.content.data?.route);
      const id = response.notification.request.identifier;
      if (destination && !handled.has(id)) {
        handled.add(id);
        router.push(destination);
        void Notifications.clearLastNotificationResponseAsync();
      }
    };
    void Notifications.getLastNotificationResponseAsync()
      .then(route)
      .catch(() => undefined);
    const listener = Notifications.addNotificationResponseReceivedListener(route);
    return () => listener.remove();
  }, [router]);
  useEffect(
    () =>
      subscribeOwner(() => {
        void clearEngagement().catch(() => undefined);
      }),
    [],
  );
  useEffect(() => {
    if (loading || error) return;
    let alive = true;
    const refresh = () => {
      if (alive)
        void refreshEngagement({ profile: active, settings: { ...settings, locale } }).catch(
          () => undefined,
        );
    };
    refresh();
    if (settings.onboardingVersion >= 1 && !settings.ageBlocked)
      void registerEngagementBackground().catch(() => undefined);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // DESIGN-GAP: A foreground minute tick detects midnight and device timezone changes.
    let zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
      day = todayIn(settings.tz ?? zone);
    const timer = setInterval(() => {
      const nextZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
        nextDay = todayIn(settings.tz ?? nextZone);
      if (day !== nextDay || zone !== nextZone) {
        day = nextDay;
        zone = nextZone;
        refresh();
      }
    }, 60000);
    return () => {
      alive = false;
      listener.remove();
      clearInterval(timer);
    };
  }, [active, settings, loading, error, locale]);
  return null;
}
