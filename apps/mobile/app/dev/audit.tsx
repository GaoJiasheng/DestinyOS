import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { File, Paths } from 'expo-file-system';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { useProfiles } from '../../lib/profiles';
import { useSystemAccessibility } from '../../lib/accessibility';
import { Page, CopyText, Action, Field } from '../../components/native-ui';
import { Preferences } from '../../components/preferences';
import { Starfield } from '../../components/effects/starfield';
import { useEffectsMotion } from '../../components/effects/motion';
import { useFrameProbe, type FrameMeasurement } from '../../lib/diagnostics/frames';
import { captureMetric } from '../../lib/monitoring';
const rows = Array.from({ length: 500 }, (_, index) => index);
// DESIGN-GAP: An explicit audit-build flag permits Release measurements; normal store builds redirect this synthetic route to /.
// DESIGN-GAP: The milestone specifies audit evidence but no audit UI copy; mobile.audit.* keys provide the same diagnostic controls in both languages.
/** Isolated public-data audit harness; compile-time opt-in also permits measuring an optimized release binary. */
export default function AuditScreen() {
  const t = useCopy();
  const { settings, updateSettings } = useProfiles();
  const { active } = useEffectsMotion();
  const params = useLocalSearchParams<{ scene?: string }>();
  const enabled = useSharedValue(false);
  useEffect(() => {
    enabled.value = active && !settings.reducedMotion;
  }, [active, settings.reducedMotion, enabled]);
  const { reduced, screenReader } = useSystemAccessibility();
  const { width, fontScale } = useWindowDimensions();
  const [scene, setScene] = useState<'starfield' | 'history'>('starfield');
  // DESIGN-GAP: Audit-only scene links allow observer-free sampling after the native automation client has disconnected.
  useEffect(() => {
    setScene(params.scene === 'history' ? 'history' : 'starfield');
    setMeasurement(null);
  }, [params.scene]);
  const [measurement, setMeasurement] = useState<FrameMeasurement | null>(null);
  const [input, setInput] = useState('');
  const list = useRef<FlatList<number>>(null);
  useEffect(() => {
    if (__DEV__ || process.env.EXPO_PUBLIC_M14_AUDIT === 'true')
      new File(Paths.document, 'M14-accessibility.json').write(
        JSON.stringify({ fontScale, reduced, screenReader, appReduced: settings.reducedMotion }),
      );
  }, [fontScale, reduced, screenReader, settings.reducedMotion]);
  const measured = useCallback(
    (value: FrameMeasurement) => {
      setMeasurement(value);
      captureMetric(scene === 'starfield' ? 'starfield.fps' : 'history.fps', value.fps);
      new File(Paths.document, `M14-${scene}.json`).write(
        JSON.stringify({
          ...value,
          fontScale,
          reduced,
          screenReader,
          hermes: 'HermesInternal' in globalThis,
        }),
      );
    },
    [scene, fontScale, reduced, screenReader],
  );
  const clock = useFrameProbe(enabled, measured, scene === 'history');
  useEffect(() => {
    if (scene !== 'history' || !active || measurement) return;
    // DESIGN-GAP: Exercise native scrolling of the same variable-height virtualized Action rows with 500 synthetic records, never real history.
    let offset = 0;
    const timer = setInterval(() => {
      offset = (offset + 350) % 20000;
      list.current?.scrollToOffset({ offset, animated: true });
    }, 650);
    return () => clearInterval(timer);
  }, [scene, active, measurement]);
  if (!__DEV__ && process.env.EXPO_PUBLIC_M14_AUDIT !== 'true') return <Redirect href="/" />;
  return (
    <Page title="mobile.audit.title" scroll={scene === 'starfield'}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Action
          id="audit-sky"
          label={t('mobile.effects.starfield')}
          selected={scene === 'starfield'}
          onPress={() => {
            setMeasurement(null);
            setScene('starfield');
          }}
        />
        <Action
          id="audit-list"
          label={t('me.history')}
          selected={scene === 'history'}
          onPress={() => {
            setMeasurement(null);
            setScene('history');
          }}
        />
        <Action
          id="audit-zh"
          label={t('nav.locale.zh')}
          onPress={() => usePreferences.getState().setLocale('zh')}
        />
        <Action
          id="audit-en"
          label={t('nav.locale.en')}
          onPress={() => usePreferences.getState().setLocale('en')}
        />
      </View>
      <CopyText testID="audit-status" status>
        {measurement
          ? t('mobile.audit.measured', { fps: measurement.fps.toFixed(2) })
          : t('mobile.audit.sampling')}
      </CopyText>
      {scene === 'starfield' ? (
        <View style={{ gap: 16 }}>
          <Starfield
            size={Math.min(width - 48, 340)}
            clock={clock}
            active={active && !settings.reducedMotion}
            labels={{}}
            diagnostics={false}
          />
          <Action
            id="audit-motion"
            label={t('mobile.audit.reduced')}
            selected={settings.reducedMotion}
            onPress={() => void updateSettings({ reducedMotion: !settings.reducedMotion })}
          />
          <Field
            id="audit-input"
            label={t('mobile.audit.field')}
            value={input}
            onChange={setInput}
          />
          <Preferences />
        </View>
      ) : (
        <FlatList
          testID="audit-history"
          ref={list}
          data={rows}
          keyExtractor={String}
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          windowSize={5}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <Action
              id={`audit-row-${item}`}
              label={t('mobile.audit.row', { count: item + 1, system: t('nav.bazi') })}
              onPress={() => undefined}
            />
          )}
        />
      )}
    </Page>
  );
}
