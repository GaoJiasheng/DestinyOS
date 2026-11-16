import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCopy } from '../lib/copy';
import { useProfiles } from '../lib/profiles';
import { CopyText, Action } from './native-ui';

// Load the encrypted store lazily so screens importing this section stay free of native crypto at module load.
const localStore = async () => (await import('../lib/data/store')).getLocalStore(null);
/** Anonymous users' only data controls: what this device holds, and a confirmed full erase. */
export function LocalDataSection() {
  const t = useCopy(),
    router = useRouter(),
    { reload } = useProfiles();
  const [summary, setSummary] = useState<{ profiles: number; readings: number } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [exportFailed, setExportFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void localStore()
      .then((store) => store.summary())
      .then((value) => {
        if (alive) setSummary(value);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function erase() {
    setBusy(true);
    setError(false);
    try {
      await (await localStore()).eraseDeviceData();
      await reload();
      // Settings are gone too, so the App starts again from onboarding.
      router.replace('/');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setBusy(true);
    setExportFailed(false);
    try {
      const { shareLocalExport } = await import('../lib/data/local-export');
      await shareLocalExport(await localStore(), t('mobile.localData.export'));
    } catch {
      setExportFailed(true);
    } finally {
      setBusy(false);
    }
  }
  const empty = !!summary && summary.profiles === 0 && summary.readings === 0;
  return (
    <>
      <CopyText title>{t('mobile.localData.title')}</CopyText>
      {summary && (
        <CopyText testID="local-data-summary">{t('mobile.localData.summary', summary)}</CopyText>
      )}
      <CopyText>{t('mobile.localData.help')}</CopyText>
      <Action
        id="local-data-export"
        disabled={busy || !summary || empty}
        label={t('mobile.localData.export')}
        onPress={() =>
          Alert.alert(t('mobile.localData.export'), t('mobile.localData.exportNote'), [
            { text: t('profiles.cancel'), style: 'cancel' },
            { text: t('mobile.localData.exportConfirm'), onPress: () => void exportData() },
          ])
        }
      />
      {empty && (
        <CopyText testID="local-data-export-empty">{t('mobile.localData.exportEmpty')}</CopyText>
      )}
      {exportFailed && <CopyText testID="local-data-export-error">{t('export.failed')}</CopyText>}
      <Action
        id="local-data-erase"
        disabled={busy}
        label={t('mobile.localData.erase')}
        onPress={() =>
          Alert.alert(t('mobile.localData.eraseTitle'), t('mobile.localData.eraseBody'), [
            { text: t('profiles.cancel'), style: 'cancel' },
            {
              text: t('mobile.localData.eraseConfirm'),
              style: 'destructive',
              onPress: () => void erase(),
            },
          ])
        }
      />
      {error && <CopyText testID="local-data-error">{t('mobile.storage.error')}</CopyText>}
    </>
  );
}
