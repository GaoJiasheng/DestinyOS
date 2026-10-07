import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import A from '../../../../packages/engine/test/fixtures/birth/A.json';
import B from '../../../../packages/engine/test/fixtures/birth/B.json';
import { BirthInputSchema } from '@tianji/shared';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { useProfiles } from '../../lib/profiles';
import { getLocalStore } from '../../lib/data/store';
import {
  createNativeReading,
  loadNativeReading,
  type NativeReading,
} from '../../lib/reports/readings';
import { useNetworkDiagnostic } from '../../lib/network';
import { diagnosticActions, resetDiagnosticConversation } from '../../lib/diagnostics/m12-actions';
import { Page, Action, CopyText } from '../../components/native-ui';
import { ReportActions } from '../../components/report/report-actions';
import { ChatScreen } from '../../components/report/chat-screen';
/** M12 acceptance reuses native production interfaces and SQLCipher fixtures with a local HTTP mock. */
export default function ActionsPreview() {
  const t = useCopy(),
    router = useRouter(),
    { reload } = useProfiles();
  const locale = usePreferences((s) => s.locale),
    offline = useNetworkDiagnostic((s) => s.offline);
  const [reading, setReading] = useState<NativeReading | null>(null),
    [chat, setChat] = useState(false),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  async function prepare() {
    setBusy(true);
    setFailed(false);
    setReading(null);
    try {
      await resetDiagnosticConversation();
      const store = await getLocalStore();
      // DESIGN-GAP: Stable synthetic IDs permit repeated screenshots without creating personal content or changing owner identity.
      const a = await store.profiles.save(
        {
          name: 'A',
          birth: BirthInputSchema.parse(A),
          version: 1,
          isCurrent: true,
          relation: 'self',
          isDefault: true,
        },
        'M12-fixture-A',
      );
      await store.profiles.save(
        {
          name: 'B',
          birth: BirthInputSchema.parse(B),
          version: 1,
          isCurrent: true,
          relation: 'partner',
          isDefault: false,
        },
        'M12-fixture-B',
      );
      await store.updateSettings({ activeProfileId: a.id, onboardingVersion: 1 });
      await reload();
      const result = await createNativeReading('bazi', a);
      setReading(await loadNativeReading(result.id, 'bazi', locale));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  if (chat && reading)
    return (
      <ChatScreen id={reading.record.id} actions={diagnosticActions} back={() => setChat(false)} />
    );
  return (
    <Page title="nav.reading">
      <Action
        id="m12-en"
        label={t('nav.locale.en')}
        onPress={() => {
          usePreferences.getState().setLocale('en');
          setReading(null);
        }}
      />
      <Action
        id="m12-zh"
        label={t('nav.locale.zh')}
        onPress={() => {
          usePreferences.getState().setLocale('zh');
          setReading(null);
        }}
      />
      <Action
        id="m12-prepare"
        label={t('mobile.account.mock.prepare')}
        disabled={busy}
        onPress={() => void prepare()}
      />
      <Action
        id="m12-offline"
        label={t(offline ? 'mobile.account.mock.online' : 'mobile.account.mock.offline')}
        onPress={() => useNetworkDiagnostic.setState({ offline: !offline })}
      />
      <Action id="m12-profiles" label={t('me.profiles')} onPress={() => router.push('/me')} />
      <Action
        id="m12-synastry"
        label={t('nav.synastry')}
        onPress={() => router.push('/synastry')}
      />
      {failed && <CopyText testID="m12-failed">{t('mobile.storage.error')}</CopyText>}
      {busy && <CopyText>{t('common.loading')}</CopyText>}
      {reading && (
        <ReportActions
          reading={reading}
          actions={diagnosticActions}
          diagnostic
          chat={() => setChat(true)}
        />
      )}
    </Page>
  );
}
