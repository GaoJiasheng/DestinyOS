import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  mobileSessionsEndpoint,
  mobileRevokeEndpoint,
  type MobileSessionsSchema,
} from '@tianji/api-client';
import type { z } from 'zod';
import { accountSession, useAccount, accountAction } from '../lib/account/controller';
import { Page, CopyText, Action } from './native-ui';
import { useCopy } from '../lib/copy';
import { usePreferences } from '../lib/preferences';
type Session = z.infer<typeof MobileSessionsSchema>['sessions'][number];
/** List only this owner's active devices and confirm individual revocation, including this device. */
export function DeviceScreen() {
  const t = useCopy(),
    state = useAccount(),
    router = useRouter(),
    locale = usePreferences((s) => s.locale);
  const [devices, setDevices] = useState<Session[]>([]),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await accountSession.request(mobileSessionsEndpoint, {});
      setDevices(result.sessions);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void accountAction(reload);
  }, [reload]);
  return (
    <Page title="mobile.account.devices">
      {!state.session ? (
        <Action label={t('auth.login.title')} onPress={() => router.replace('/auth/login')} />
      ) : (
        <>
          {loading && <CopyText>{t('mobile.profiles.loading')}</CopyText>}
          {!loading && devices.length === 0 && (
            <CopyText>{t('mobile.account.devices.empty')}</CopyText>
          )}
          {devices.map((item) => (
            <Action
              key={item.id}
              id={`account-device-${item.current ? 'current' : 'other'}`}
              disabled={state.busy}
              label={item.deviceName}
              onPress={() =>
                Alert.alert(t('mobile.account.device.revoke'), t('mobile.account.device.confirm'), [
                  { text: t('mobile.ask.close'), style: 'cancel' },
                  {
                    text: t('mobile.account.device.revoke'),
                    style: 'destructive',
                    onPress: () =>
                      void accountAction(async () => {
                        await accountSession.request(mobileRevokeEndpoint, { sessionId: item.id });
                        if (item.current) {
                          await accountSession.clear();
                          router.replace('/auth/login');
                        } else await reload();
                      }),
                  },
                ])
              }
            >
              <CopyText>
                {t(item.current ? 'mobile.account.device.current' : 'mobile.account.device.revoke')}
              </CopyText>
              <CopyText>
                {t('mobile.account.device.lastUsed', {
                  time: new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.lastUsedAt)),
                })}
              </CopyText>
            </Action>
          ))}
          <Action
            id="account-devices-retry"
            disabled={state.busy}
            label={t('mobile.profiles.retry')}
            onPress={() => void accountAction(reload)}
          />
        </>
      )}
      {state.error && <CopyText testID="account-error">{t(state.error)}</CopyText>}
    </Page>
  );
}
