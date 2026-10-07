import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useProfiles } from '../lib/profiles';
import { useCopy } from '../lib/copy';
import { createNativeReading, readingError } from '../lib/reports/readings';
import { useChartLabel } from './report/report-ui';
import { Page, Action, CopyText } from './native-ui';
/** Two different saved profiles only; swapping preserves the documented directional Ashtakoot roles. */
export function SynastryScreen() {
  const t = useCopy(),
    label = useChartLabel(),
    router = useRouter(),
    { profiles, active, loading } = useProfiles();
  const [a, setA] = useState(active?.id ?? ''),
    [b, setB] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!a && active) setA(active.id);
  }, [a, active]);
  const first = profiles.find((p) => p.id === a),
    second = profiles.find((p) => p.id === b);
  async function create() {
    if (busy || !first?.data || !second?.data || a === b) return;
    setBusy(true);
    setError('');
    try {
      const reading = await createNativeReading('synastry', first, second);
      router.push({ pathname: '/[system]/r/[id]', params: { system: 'synastry', id: reading.id } });
    } catch (cause) {
      setError(readingError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="nav.synastry">
      {loading && <CopyText>{t('common.loading')}</CopyText>}
      {error && <CopyText>{label(error)}</CopyText>}
      {(['a', 'b'] as const).map((side) => (
        <ReactGroup key={side}>
          <CopyText title>{t(`synastry.${side}`)}</CopyText>
          {profiles.map((profile) => (
            <Action
              key={profile.id}
              id={`synastry-${side}-${profile.id}`}
              label={profile.data?.name || t('mobile.profiles.unnamed')}
              selected={(side === 'a' ? a : b) === profile.id}
              disabled={busy || profile.id === (side === 'a' ? b : a)}
              onPress={() => (side === 'a' ? setA(profile.id) : setB(profile.id))}
            />
          ))}
        </ReactGroup>
      ))}
      {(first?.data?.birth.timeUnknown || second?.data?.birth.timeUnknown) && (
        <CopyText>{t('engine.warnings.W_NOON_CHART')}</CopyText>
      )}
      <CopyText>{t('mobile.synastry.direction')}</CopyText>
      <Action
        id="synastry-swap"
        label={t('mobile.synastry.swap')}
        disabled={busy || !a || !b}
        onPress={() => {
          setA(b);
          setB(a);
        }}
      />
      {profiles.length < 2 && <CopyText>{t('mobile.synastry.needTwo')}</CopyText>}
      <Action
        id="synastry-add"
        label={t('mobile.profiles.add')}
        disabled={busy}
        onPress={() => router.push('/me/birth')}
      />
      <Action
        id="synastry-create"
        label={t('mobile.synastry.create')}
        disabled={busy || !first || !second || a === b}
        onPress={() => void create()}
      />
      {busy && <CopyText>{t('report.loading')}</CopyText>}
    </Page>
  );
}
import { Fragment as ReactGroup } from 'react';
