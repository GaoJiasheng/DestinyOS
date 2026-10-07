import { useEffect, useState } from 'react';
import { Linking, AppState } from 'react-native';
import { getPermissionsAsync } from 'expo-notifications';
import { useProfiles } from '../../lib/profiles';
import { useCopy } from '../../lib/copy';
import { ReportCard } from '../report/report-ui';
import { Action, CopyText } from '../native-ui';
/** Once-only, dismissible settings hint after the OS denies notification permission. */
export function NotificationHint() {
  const { settings, updateSettings } = useProfiles(),
    t = useCopy();
  const [denied, setDenied] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void getPermissionsAsync()
        .then((permission) => {
          if (alive) setDenied(permission.status === 'denied');
        })
        .catch(() => undefined);
    };
    refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  if (!denied || settings.dailyNotificationHintDismissed) return null;
  return (
    <ReportCard id="daily-notifications">
      <CopyText>{t('mobile.onboarding.notifications.denied')}</CopyText>
      <Action
        label={t('mobile.daily.openSettings')}
        onPress={() => {
          void Linking.openSettings().catch(() => setError(true));
        }}
      />
      <Action
        label={t('common.close')}
        onPress={() => {
          void updateSettings({ dailyNotificationHintDismissed: true }).catch(() => setError(true));
        }}
      />
      {error && <CopyText>{t('mobile.storage.error')}</CopyText>}
    </ReportCard>
  );
}
