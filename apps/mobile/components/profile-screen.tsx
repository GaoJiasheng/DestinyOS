import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useProfiles } from '../lib/profiles';
import { useCopy } from '../lib/copy';
import { Page, Action, CopyText } from './native-ui';
import { Preferences } from './preferences';
/** Multi-profile selection and editing use the encrypted store; default summaries omit full birth dates. */
export function ProfileScreen() {
  const t = useCopy();
  const router = useRouter();
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const { profiles, active, select, remove } = useProfiles();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="nav.me">
      {saved === '1' && <CopyText testID="profile-saved">{t('mobile.profile.saved')}</CopyText>}
      <CopyText title>{t('me.profiles')}</CopyText>
      {profiles.length === 0 && <CopyText>{t('mobile.profiles.empty')}</CopyText>}
      <View style={{ gap: 12 }}>
        {profiles.map((profile) => (
          <Action
            key={profile.id}
            id={`profile-${profile.id}`}
            disabled={busy}
            label={profile.data?.name || t('mobile.profiles.unnamed')}
            selected={active?.id === profile.id}
            onPress={() => void run(() => select(profile.id))}
          >
            {active?.id === profile.id && (
              <CopyText testID="active-profile">{t('mobile.profiles.active')}</CopyText>
            )}
          </Action>
        ))}
      </View>
      <Action
        id="profile-add"
        label={t('mobile.profiles.add')}
        onPress={() => router.push('/me/birth')}
      />
      {active && (
        <>
          <Action
            id="profile-edit"
            label={t('mobile.profiles.edit')}
            onPress={() => router.push({ pathname: '/me/birth', params: { id: active.id } })}
          />
          <Action
            id="profile-delete"
            disabled={busy}
            label={t('mobile.profiles.delete')}
            onPress={() =>
              Alert.alert(t('mobile.profiles.delete'), t('mobile.profiles.delete.confirm'), [
                { text: t('mobile.ask.close'), style: 'cancel' },
                {
                  text: t('mobile.profiles.delete'),
                  style: 'destructive',
                  onPress: () => void run(() => remove(active.id)),
                },
              ])
            }
          />
        </>
      )}
      {failed && <CopyText>{t('mobile.storage.error')}</CopyText>}
      <Action id="me-journal" label={t('me.journal')} onPress={() => router.push('/me/journal')} />
      <Action
        id="me-settings"
        label={t('me.settings')}
        onPress={() => router.push('/me/settings')}
      />
      <Preferences />
    </Page>
  );
}
