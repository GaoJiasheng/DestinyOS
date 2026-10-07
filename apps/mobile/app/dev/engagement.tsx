import { TurboModuleRegistry, type TurboModule } from 'react-native';
import { useState, useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import { Page, Action, CopyText } from '../../components/native-ui';
import { useProfiles } from '../../lib/profiles';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { getLocalStore } from '../../lib/data/store';
import { setCurrentOwner } from '../../lib/account/scope';
import { requestNotificationPermission } from '../../lib/notifications';
import { refreshEngagement, readEngagementContext } from '../../lib/engagement/service';
import { planEngagement } from '../../lib/engagement/planner';
import { runEngagementBackground } from '../../lib/engagement/background';

/** Development-only synthetic local scenarios; use a dedicated empty simulator for acceptance. */
export default function EngagementDiagnostics() {
  const t = useCopy(),
    router = useRouter(),
    { reload } = useProfiles();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [count, setCount] = useState<number | null>(null),
    [route, setRoute] = useState('/me/birth'),
    [background, setBackground] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    // DESIGN-GAP: Freeze Fast Refresh during native acceptance, matching the existing M10 harness.
    if (__DEV__)
      TurboModuleRegistry.get<TurboModule & { setHotLoadingEnabled(enabled: boolean): void }>(
        'DevSettings',
      )?.setHotLoadingEnabled(false);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError(false);
    try {
      await work();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    await refreshEngagement();
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    setCount(requests.filter((r) => r.identifier.startsWith('tianji:daily:')).length);
    setRoute((await readEngagementContext()).profile ? '/today' : '/me/birth');
  }
  async function prepare(personal: boolean) {
    setCurrentOwner(null);
    const store = await getLocalStore(null);
    // DESIGN-GAP: Repeated acceptance runs use fresh fixture IDs because synced tombstones cannot be resurrected.
    for (const fixture of await store.profiles.list(500))
      if (fixture.id.startsWith('M11-synthetic-')) await store.profiles.delete(fixture.id);
    let profileId: string | null = null;
    if (personal) {
      const fixture = await store.profiles.save(
        { name: '', birth: BirthInputSchema.parse(A), version: 1, isCurrent: true },
        `M11-synthetic-${Date.now()}`,
      );
      profileId = fixture.id;
    }
    await store.updateSettings({
      onboardingVersion: 1,
      ageBlocked: false,
      activeProfileId: profileId,
      dailyPushEnabled: true,
      specialDayReminders: true,
      locale: usePreferences.getState().locale,
    });
    await requestNotificationPermission(t('mobile.push.title'));
    await reload();
    await check();
  }
  return (
    <Page title="mobile.push.test.title">
      {(['zh', 'zh-TW', 'en'] as const).map((locale) => (
        <Action
          key={locale}
          id={`engagement-${locale}`}
          label={t(`nav.locale.${locale}`)}
          onPress={() => usePreferences.getState().setLocale(locale)}
        />
      ))}
      <Action
        id="engagement-empty"
        disabled={busy}
        label={t('mobile.push.test.empty')}
        onPress={() => void action(() => prepare(false))}
      />
      <Action
        id="engagement-profile"
        disabled={busy}
        label={t('mobile.push.test.profile')}
        onPress={() => void action(() => prepare(true))}
      />
      <Action
        id="engagement-schedule"
        disabled={busy}
        label={t('mobile.push.test.schedule')}
        onPress={() => void action(check)}
      />
      {count !== null && (
        <CopyText testID="engagement-result">
          {t('mobile.push.test.ready', { count, route })}
        </CopyText>
      )}
      <Action
        id="engagement-send"
        disabled={busy}
        label={t('mobile.push.test.send')}
        onPress={() =>
          void action(async () => {
            setSent(false);
            const context = await readEngagementContext();
            const reminder = planEngagement(context.profile, context.settings).reminders.find(
              (item) => item.id.includes(':daily:'),
            );
            if (!reminder) throw new Error('No daily reminder');
            const destination = reminder.route;
            await Notifications.scheduleNotificationAsync({
              identifier: `m11-test-${Date.now()}`,
              content: {
                title: reminder.title,
                body: reminder.body,
                data: { route: destination },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 10,
                channelId: 'daily',
              },
            });
            setSent(true);
          })
        }
      />
      {sent && <CopyText testID="engagement-sent">{t('mobile.push.test.sent')}</CopyText>}
      <Action
        id="engagement-background"
        disabled={busy}
        label={t('mobile.push.test.background')}
        onPress={() =>
          void action(async () => {
            // DESIGN-GAP: BGTaskScheduler is unavailable in iOS Simulator. Execute the identical
            // registered task function directly, without pretending the OS dispatched it.
            if ((await runEngagementBackground()) !== BackgroundTask.BackgroundTaskResult.Success)
              throw new Error('Background refresh failed');
            await check();
            setBackground(true);
          })
        }
      />
      {background && (
        <CopyText testID="engagement-background-done">
          {t('mobile.push.test.backgroundDone')}
        </CopyText>
      )}
      <Action
        id="engagement-settings"
        label={t('mobile.push.title')}
        onPress={() => router.push('/me/settings/notifications')}
      />
      {error && <CopyText testID="engagement-error">{t('mobile.push.error')}</CopyText>}
    </Page>
  );
}
