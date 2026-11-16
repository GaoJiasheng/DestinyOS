import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Page, CopyText, Action } from '../components/native-ui';
import { useCopy } from '../lib/copy';
import { useProfiles } from '../lib/profiles';
import { useAccount, logoutAccount } from '../lib/account/controller';
/** The 13+ block is device-wide and survives restarts; the only way out is erasing this device. */
export default function AgeRestricted() {
  const t = useCopy();
  const router = useRouter();
  const { reload } = useProfiles();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function erase() {
    setBusy(true);
    setFailed(false);
    try {
      // Sign out first so the erase below runs against the anonymous scope; the account itself stays.
      if (useAccount.getState().session) await logoutAccount();
      const { getLocalStore } = await import('../lib/data/store');
      await (await getLocalStore(null)).eraseDeviceData();
      await reload();
      router.replace('/');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="mobile.age.title">
      <CopyText>{t('mobile.age.body')}</CopyText>
      <Action
        id="age-erase"
        disabled={busy}
        label={t('mobile.age.erase')}
        onPress={() =>
          Alert.alert(t('mobile.age.eraseTitle'), t('mobile.age.eraseBody'), [
            { text: t('profiles.cancel'), style: 'cancel' },
            {
              text: t('mobile.age.eraseConfirm'),
              style: 'destructive',
              onPress: () => void erase(),
            },
          ])
        }
      />
      {failed && <CopyText testID="age-erase-error">{t('mobile.age.eraseError')}</CopyText>}
    </Page>
  );
}
