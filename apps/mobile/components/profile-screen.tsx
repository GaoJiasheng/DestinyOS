import { membershipEnabled } from '../lib/monetization/features';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  anonymousProfileLimit,
  profileDisplayName,
  profileLimitReached,
  useProfiles,
} from '../lib/profiles';
import { useCopy } from '../lib/copy';
import { Page, Action, CopyText } from './native-ui';
import { Preferences } from './preferences';
/** Multi-profile selection and editing use the encrypted store; default summaries omit full birth dates. */
export function ProfileScreen() {
  const t = useCopy();
  const router = useRouter();
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const { profiles, active, select, remove, setDefault } = useProfiles();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [switched, setSwitched] = useState<string | null>(null);
  const atLimit = profileLimitReached(profiles);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    setSwitched(null);
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
      {switched && (
        <CopyText testID="profile-switched" status>
          {t('mobile.profiles.switched', { name: switched })}
        </CopyText>
      )}
      <View style={{ gap: 16 }}>
        {profiles.map((profile) => {
          const label = profileDisplayName(profile, t('mobile.profiles.unnamed'));
          const isActive = active?.id === profile.id;
          const row = (action: string) => t('mobile.profiles.rowAction', { action, name: label });
          return (
            <View key={profile.id} style={{ gap: 8 }}>
              {/* DESIGN-GAP: Tapping a row no longer switches silently; switching is an explicit button with a confirmation line. */}
              <Action
                id={`profile-${profile.id}`}
                disabled={busy || isActive}
                label={isActive ? label : row(t('profiles.select'))}
                selected={isActive}
                onPress={() =>
                  void run(async () => {
                    await select(profile.id);
                    setSwitched(label);
                  })
                }
              >
                <CopyText>
                  {t(`profiles.relation.${profile.data?.relation ?? 'self'}`)}
                  {profile.data?.isDefault ? ` · ${t('profiles.default')}` : ''}
                </CopyText>
                {isActive && (
                  <CopyText testID="active-profile">{t('mobile.profiles.active')}</CopyText>
                )}
              </Action>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Action
                  id={`profile-edit-${profile.id}`}
                  label={row(t('profiles.edit'))}
                  onPress={() => router.push({ pathname: '/me/birth', params: { id: profile.id } })}
                />
                <Action
                  id={`profile-delete-${profile.id}`}
                  disabled={busy}
                  label={row(t('profiles.delete'))}
                  onPress={() =>
                    Alert.alert(t('profiles.delete'), t('mobile.profiles.delete.confirm'), [
                      { text: t('profiles.cancel'), style: 'cancel' },
                      {
                        text: t('profiles.delete'),
                        style: 'destructive',
                        onPress: () => void run(() => remove(profile.id)),
                      },
                    ])
                  }
                />
              </View>
            </View>
          );
        })}
      </View>
      <Action
        id="profile-add"
        disabled={atLimit}
        label={t('mobile.profiles.add')}
        onPress={() => router.push('/me/birth')}
      />
      {atLimit && (
        <CopyText testID="profile-limit">
          {t('mobile.profiles.limit', { limit: anonymousProfileLimit })}
        </CopyText>
      )}
      {active && (
        <Action
          id="profile-default"
          label={t(active.data?.isDefault ? 'profiles.default' : 'profiles.setDefault')}
          disabled={busy || active.data?.isDefault}
          onPress={() => void run(() => setDefault(active.id))}
        />
      )}
      {failed && <CopyText>{t('mobile.storage.error')}</CopyText>}
      <Action id="me-journal" label={t('me.journal')} onPress={() => router.push('/me/journal')} />
      <Action
        id="me-settings"
        label={t('me.settings')}
        onPress={() => router.push('/me/settings')}
      />
      <Action
        id="profile-history"
        label={t('me.history')}
        onPress={() => router.push('/me/history')}
      />
      {membershipEnabled() && (
        <Action
          id="me-billing"
          label={t('billing.title')}
          onPress={() => router.push('/me/billing')}
        />
      )}
      <Preferences />
    </Page>
  );
}
