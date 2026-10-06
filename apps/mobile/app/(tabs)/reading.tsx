import { View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useProfiles } from '../../lib/profiles';
import { useCopy } from '../../lib/copy';
import { Page, CopyText, Action } from '../../components/native-ui';
import { createNativeReading, readingError, type ReportSystem } from '../../lib/reports/readings';
import { useChartLabel, ReportSheet } from '../../components/report/report-ui';
/** One-tap local reports use the active encrypted profile; divination retains the M07 routes. */
export default function ReadingScreen() {
  const t = useCopy();
  const router = useRouter();
  const { active, profiles } = useProfiles();
  const label = useChartLabel();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [pair, setPair] = useState(false);
  async function create(system: ReportSystem, partner?: (typeof profiles)[number]) {
    if (busy) return;
    if (!active?.data) {
      router.push('/me/birth');
      return;
    }
    setBusy(true);
    setError(null);
    setPair(false);
    try {
      const reading = await createNativeReading(system, active, partner);
      router.push({ pathname: '/[system]/r/[id]', params: { system, id: reading.id } });
    } catch (cause) {
      setError(readingError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="nav.reading">
      <CopyText>{active?.data?.name || t('mobile.profiles.empty')}</CopyText>
      {busy ? <CopyText>{t('report.loading')}</CopyText> : null}
      {error ? <CopyText>{label(error)}</CopyText> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(
          ['bazi', 'ziwei', 'iching', 'qimen', 'tarot', 'astrology', 'vedic', 'numerology'] as const
        ).map((system) => (
          <View key={system} style={{ width: '47%' }}>
            <Action
              id={`system-${system}`}
              label={t(`nav.${system}`)}
              disabled={busy}
              onPress={() =>
                system === 'tarot'
                  ? router.push('/tarot/reading')
                  : system === 'iching'
                    ? router.push('/iching')
                    : system === 'qimen'
                      ? router.push('/qimen')
                      : void create(system)
              }
            />
          </View>
        ))}
      </View>
      <Action
        id="system-synastry"
        label={t('mobile.reading.synastry')}
        disabled={busy}
        onPress={() => setPair(true)}
      />
      {pair ? (
        <ReportSheet title={t('synastry.b')} close={() => setPair(false)}>
          {profiles
            .filter((p) => p.id !== active?.id)
            .map((p) => (
              <Action
                key={p.id}
                label={t('report.content', { text: p.data?.name || t('mobile.profiles.unnamed') })}
                onPress={() => void create('synastry', p)}
              />
            ))}
          <Action
            label={t('mobile.profiles.add')}
            onPress={() => {
              setPair(false);
              router.push('/me/birth');
            }}
          />
        </ReportSheet>
      ) : null}
    </Page>
  );
}
