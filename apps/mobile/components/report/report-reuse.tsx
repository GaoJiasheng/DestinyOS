import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { useProfiles } from '../../lib/profiles';
import { useTheme } from '../../lib/theme';
import { createNativeReading, readingError, type NativeReading } from '../../lib/reports/readings';
import { isNatalSystem, yieldFrame } from '../../lib/reports/launch';
import { CopyText, Action } from '../native-ui';
import { ReportCard, useChartLabel } from './report-ui';

/** Shown when the Reading tab reopened a saved report: offers a fresh cast or a different person. */
export function ReportReuse({ reading }: { reading: NativeReading }) {
  const t = useCopy(),
    label = useChartLabel(),
    router = useRouter(),
    { colors } = useTheme(),
    locale = usePreferences((s) => s.locale),
    { profiles } = useProfiles();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const data = reading.record.data;
  if (!data || !isNatalSystem(data.system)) return null;
  const system = data.system;
  const profile = profiles.find((p) => p.id === data.profileId && p.data);
  const date = new Date(reading.record.createdAt).toLocaleDateString(locale);
  async function recast() {
    if (busy || !profile) return;
    setBusy(true);
    setError(null);
    try {
      await yieldFrame();
      const name = data?.inputSnapshot.name || undefined;
      const fresh = await createNativeReading(
        system,
        profile,
        undefined,
        undefined,
        undefined,
        name ? { name } : undefined,
      );
      router.replace({ pathname: '/[system]/r/[id]', params: { system, id: fresh.id } });
    } catch (cause) {
      setError(readingError(cause));
      setBusy(false);
    }
  }
  return (
    <ReportCard id="report-reused">
      <CopyText>{t('mobile.report.reused', { date })}</CopyText>
      {busy ? (
        <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.gold} />
          <CopyText status>{t('mobile.launch.working', { system: t(`nav.${system}`) })}</CopyText>
        </View>
      ) : null}
      {error ? <CopyText>{label(error)}</CopyText> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {profile ? (
          <Action
            id="report-recast"
            label={t('mobile.report.recast')}
            disabled={busy}
            onPress={() => void recast()}
          />
        ) : null}
        <Action
          id="report-someone-else"
          label={t('home.launch.someoneElse')}
          disabled={busy}
          onPress={() =>
            router.push({
              pathname: '/me/birth',
              params: {
                relation: 'other',
                system,
                returnTo: `/reading?system=${system}&after=${encodeURIComponent(new Date().toISOString())}`,
              },
            })
          }
        />
      </View>
    </ReportCard>
  );
}
