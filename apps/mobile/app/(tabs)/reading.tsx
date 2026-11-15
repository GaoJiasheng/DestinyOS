import { View, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProfiles } from '../../lib/profiles';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { Page, CopyText, Action, Field } from '../../components/native-ui';
import { createNativeReading, readingError } from '../../lib/reports/readings';
import {
  findExistingReading,
  isNatalSystem,
  numerologyName,
  yieldFrame,
  type NatalSystem,
} from '../../lib/reports/launch';
import { useChartLabel } from '../../components/report/report-ui';
import type { LocalRecord, Profile } from '../../lib/data/models';

const systems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
] as const;
type Panel = { kind: 'numerology'; name: string; invalid: boolean } | { kind: 'needsTime' } | null;

/** Natal reports reopen the newest matching snapshot for the chosen profile; divination keeps its ritual routes. */
export default function ReadingScreen() {
  const t = useCopy();
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ system?: string; after?: string; profile?: string }>();
  const { active, profiles, loading } = useProfiles();
  const label = useChartLabel();
  const [chosenId, setChosenId] = useState<string | null>(null),
    [busy, setBusy] = useState<NatalSystem | null>(null),
    [error, setError] = useState<string | null>(null),
    [panel, setPanel] = useState<Panel>(null);
  const handled = useRef('');
  const chosen =
    profiles.find((p) => p.id === chosenId && p.data) ?? (active?.data ? active : null);
  const name = chosen?.data?.name || t('mobile.profiles.unnamed');

  function addPerson(system?: NatalSystem) {
    const back = system
      ? `/reading?system=${system}&after=${encodeURIComponent(new Date().toISOString())}`
      : '/reading';
    router.push({
      pathname: '/me/birth',
      // The very first profile is the user's own; later ones started here are for someone else.
      params: {
        returnTo: back,
        ...(profiles.length ? { relation: 'other' } : {}),
        ...(system ? { system } : {}),
      },
    });
  }
  async function launch(system: NatalSystem, profile: LocalRecord<Profile>, latin?: string) {
    if (busy) return;
    setBusy(system);
    setError(null);
    setPanel(null);
    try {
      const existing = await findExistingReading(system, profile, latin);
      if (existing) {
        router.push({
          pathname: '/[system]/r/[id]',
          params: { system, id: existing, reused: '1' },
        });
        return;
      }
      await yieldFrame();
      const reading = await createNativeReading(
        system,
        profile,
        undefined,
        undefined,
        undefined,
        latin ? { name: latin } : undefined,
      );
      router.push({ pathname: '/[system]/r/[id]', params: { system, id: reading.id } });
    } catch (cause) {
      setError(readingError(cause));
    } finally {
      setBusy(null);
    }
  }
  function start(system: NatalSystem, profile: LocalRecord<Profile> | null = chosen) {
    if (busy) return;
    setError(null);
    if (!profile?.data) {
      addPerson(system);
      return;
    }
    if (system === 'ziwei' && profile.data.birth.timeUnknown) {
      setPanel({ kind: 'needsTime' });
      return;
    }
    if (system === 'numerology') {
      setPanel({
        kind: 'numerology',
        name: numerologyName(profile.data.name) ?? '',
        invalid: false,
      });
      return;
    }
    void launch(system, profile);
  }
  // Returning from the birth form carries the system to cast and, for edits, the profile it changed.
  useEffect(() => {
    const system = params.system;
    if (loading || !isNatalSystem(system)) return;
    const key = `${system}|${params.after ?? ''}|${params.profile ?? ''}`;
    if (handled.current === key) return;
    const after = params.after ?? '';
    const target =
      profiles.find((p) => p.id === params.profile && p.data) ??
      profiles
        .filter((p) => p.data && after && p.updatedAt >= after)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
      null;
    // The saved profile may reach this projection a render later; wait for it before consuming the params.
    if (!target) return;
    handled.current = key;
    router.setParams({ system: undefined, after: undefined, profile: undefined });
    setChosenId(target.id);
    start(system, target);
    // start reads the latest state; rerunning it on every render would recast in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.system, params.after, params.profile, loading, profiles]);

  return (
    <Page title="nav.reading">
      <CopyText testID="reading-current">
        {chosen ? t('mobile.launch.current', { name }) : t('mobile.profiles.empty')}
      </CopyText>
      {profiles.length > 1 ? (
        <View
          accessibilityLabel={t('mobile.launch.choose')}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {profiles.map((profile) => (
            <Action
              key={profile.id}
              id={`reading-profile-${profile.id}`}
              label={profile.data?.name || t('mobile.profiles.unnamed')}
              selected={chosen?.id === profile.id}
              disabled={!!busy}
              onPress={() => {
                setChosenId(profile.id);
                setPanel(null);
              }}
            />
          ))}
        </View>
      ) : null}
      <Action
        id="reading-someone-else"
        label={t('home.launch.someoneElse')}
        disabled={!!busy}
        onPress={() => addPerson()}
      />
      {busy ? (
        <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.gold} />
          <CopyText status testID="reading-busy">
            {t('mobile.launch.working', { system: t(`nav.${busy}`) })}
          </CopyText>
        </View>
      ) : null}
      {error ? <CopyText>{label(error)}</CopyText> : null}
      {panel?.kind === 'needsTime' && chosen ? (
        <View testID="reading-needs-time" style={{ gap: 8 }}>
          <CopyText>{t('mobile.launch.needsTimeBody')}</CopyText>
          <Action
            id="reading-add-time"
            label={t('mobile.launch.addTime')}
            onPress={() =>
              router.push({
                pathname: '/me/birth',
                params: {
                  id: chosen.id,
                  system: 'ziwei',
                  returnTo: `/reading?system=ziwei&profile=${encodeURIComponent(chosen.id)}`,
                },
              })
            }
          />
        </View>
      ) : null}
      {panel?.kind === 'numerology' && chosen ? (
        <View testID="reading-numerology" style={{ gap: 8 }}>
          <Field
            id="reading-numerology-name"
            label={t('numerology.name')}
            value={panel.name}
            maxLength={120}
            onChange={(value) => setPanel({ kind: 'numerology', name: value, invalid: false })}
          />
          <CopyText>{t(panel.invalid ? 'numerology.nameError' : 'numerology.nameHelp')}</CopyText>
          <Action
            id="reading-numerology-start"
            label={t('mobile.launch.calculate')}
            disabled={!!busy}
            onPress={() => {
              const latin = numerologyName(panel.name);
              if (panel.name.trim() && !latin) setPanel({ ...panel, invalid: true });
              else void launch('numerology', chosen, latin);
            }}
          />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {systems.map((system) => (
          <View key={system} style={{ width: '47%' }}>
            <Action
              id={`system-${system}`}
              label={
                system === 'ziwei' && chosen?.data?.birth.timeUnknown
                  ? t('mobile.launch.needsTime', { system: t('nav.ziwei') })
                  : t(`nav.${system}`)
              }
              disabled={!!busy}
              onPress={() =>
                system === 'tarot'
                  ? router.push('/tarot/reading')
                  : system === 'iching'
                    ? router.push('/iching')
                    : system === 'qimen'
                      ? router.push('/qimen')
                      : start(system)
              }
            />
          </View>
        ))}
      </View>
      <Action
        id="system-synastry"
        label={t('mobile.reading.synastry')}
        disabled={!!busy}
        onPress={() => router.push('/synastry')}
      />
    </Page>
  );
}
