import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { AstroChartSchema } from '@tianji/shared';
import { designTokens, spacing, nativeTypography } from '@tianji/ui-core/tokens';
import { useTheme } from '../../lib/theme';
import { useEffectsCopy, planetKeys } from '../../lib/effects-copy';
import {
  checkEngine,
  checkRuntime,
  type EngineMeasurement,
} from '../../lib/diagnostics/engine-check';
import { fixtureChart } from '../../lib/diagnostics/fixture';
import {
  effectNames,
  targets,
  meetsFrameBudget,
  useFrameProbe,
  type EffectName,
  type FrameMeasurement,
} from '../../lib/diagnostics/frames';
import { useEffectsMotion } from '../../components/effects/motion';
import { Starfield } from '../../components/effects/starfield';
import { Sphere } from '../../components/effects/sphere';
import { Particles, type ParticlePreset } from '../../components/effects/particles';
import { TarotFlip, Coins } from '../../components/effects/rituals';
import { Wheel } from '../../components/effects/wheel';
/** Developer-only offline performance and correctness harness, reachable at /dev/effects. */
export default function EffectsPage() {
  const params = useLocalSearchParams<{ effect?: string }>();
  const initial = effectNames.find((name) => name === params.effect) ?? 'starfield';
  const [effect, setEffect] = useState<EffectName>(initial);
  const [run, setRun] = useState(0);
  const [rows, setRows] = useState<EngineMeasurement[]>([]);
  const [status, setStatus] = useState<'engine' | 'running' | 'passed' | 'failed'>('engine');
  const t = useEffectsCopy(),
    { colors, body } = useTheme();
  const chart = useMemo(() => AstroChartSchema.parse(fixtureChart('astrology')), []);
  const text = { color: colors['text-1'], fontFamily: body, fontSize: nativeTypography.small };
  const check = async () => {
    setStatus('running');
    try {
      const runtime = checkRuntime();
      const result = await checkEngine((progress) => {
        new File(Paths.document, 'M02-engine-progress.json').write(JSON.stringify(progress));
      });
      setRows(result);
      const hermes = 'HermesInternal' in globalThis;
      const passed = hermes && result.every((row) => row.passed);
      setStatus(passed ? 'passed' : 'failed');
      new File(Paths.document, 'M02-engine.json').write(
        JSON.stringify(
          {
            hermes,
            runtime,
            textEncoder: typeof TextEncoder !== 'undefined',
            intl: Intl.DateTimeFormat().resolvedOptions().timeZone,
            passed,
            rows: result,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      new File(Paths.document, 'M02-engine.json').write(
        JSON.stringify({ passed: false, error: String(error) }),
      );
      setStatus('failed');
    }
  };
  // DESIGN-GAP: /dev routes ship as internal diagnostics in M02; no personal data is used or exported.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors['bg-0'] }}>
      <ScrollView contentContainerStyle={{ padding: spacing('space-4'), gap: spacing('space-3') }}>
        <Text
          accessibilityRole="header"
          style={{ ...text, fontSize: nativeTypography.h1, color: colors.gold }}
        >
          {t('title')}
        </Text>
        <Text style={text}>{t('intro')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing('space-2') }}>
          {effectNames.map((name) => (
            <Pressable
              key={name}
              testID={`effect-${name}`}
              accessibilityRole="button"
              accessibilityState={{ selected: effect === name }}
              onPress={() => {
                setEffect(name);
                setRun((value) => value + 1);
              }}
              style={{
                padding: spacing('space-3'),
                borderWidth: 1,
                borderColor: effect === name ? colors.gold : colors['line-2'],
                borderRadius: spacing('space-2'),
              }}
            >
              <Text style={text}>{t(name)}</Text>
            </Pressable>
          ))}
        </View>
        <EffectStage key={`${effect}-${run}`} name={effect} chart={chart} />
        <Pressable
          testID="engine-check"
          accessibilityRole="button"
          disabled={status === 'running'}
          onPress={() => {
            void check();
          }}
          style={{
            padding: spacing('space-4'),
            backgroundColor: colors['surface-2'],
            borderRadius: spacing('space-2'),
          }}
        >
          <Text style={text}>{t(status)}</Text>
        </Pressable>
        <Text testID={`engine-${status}`} style={text}>
          {t(status)}
        </Text>
        {rows.map((row) => (
          <Text
            key={`${row.system}-${row.locale}`}
            style={{ ...text, color: row.passed ? colors.success : colors.danger }}
          >
            {t('timing', {
              system: row.system,
              locale: row.locale,
              cold: row.coldMs.toFixed(1),
              max: row.maxMs.toFixed(1),
            })}
          </Text>
        ))}
        <Text style={text}>{t('disclaimer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
function EffectStage({
  name,
  chart,
}: {
  name: EffectName;
  chart: ReturnType<typeof AstroChartSchema.parse>;
}) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - spacing('space-4') * 2, 440);
  const motion = useEffectsMotion(),
    t = useEffectsCopy();
  const [measurement, setMeasurement] = useState<FrameMeasurement | null>(null);
  const [fallback, setFallback] = useState(false);
  const [preset, setPreset] = useState<ParticlePreset>('sparkle');
  const fail = useCallback(() => {
    setFallback(true);
    setMeasurement(null);
  }, []);
  const measured = useCallback(
    (value: FrameMeasurement) => {
      setMeasurement(value);
      new File(Paths.document, `M02-${name}.json`).write(
        JSON.stringify(
          {
            name,
            fallback,
            active: motion.active,
            target: targets[name],
            passed: meetsFrameBudget(value.fps, targets[name]),
            ...value,
          },
          null,
          2,
        ),
      );
    },
    [name, fallback, motion.active],
  );
  const clock = useFrameProbe(
    motion.enabled,
    (value) => {
      if (name !== 'sphere' || fallback) measured(value);
    },
    fallback,
  );
  const labels = Object.fromEntries(planetKeys.map((key) => [key, t(`planets.${key}`)]));
  return (
    <View style={{ gap: spacing('space-3') }}>
      <View
        testID={`scene-${name}`}
        style={{
          width: size,
          height: size,
          // DESIGN-GAP: Preview dark ink against the documented cream text color as a paper surface.
          backgroundColor:
            name === 'particles' && preset === 'ink'
              ? designTokens.base['text-1']
              : designTokens.base['bg-1'],
          overflow: 'hidden',
          borderRadius: spacing('space-4'),
        }}
      >
        {name === 'starfield' && (
          <Starfield size={size} clock={clock} active={motion.active} labels={labels} />
        )}
        {name === 'sphere' && !fallback && (
          <Sphere
            chart={chart}
            size={size}
            active={motion.active}
            onFailure={fail}
            onMeasured={measured}
          />
        )}
        {(name === 'wheel' || (name === 'sphere' && fallback)) && (
          <Wheel size={size} clock={clock} chart={chart} animated={motion.active} />
        )}
        {name === 'particles' && motion.active && (
          <Particles size={size} clock={clock} preset={preset} />
        )}
        {name === 'tarot' && <TarotFlip clock={clock} active={motion.active} />}
        {name === 'coins' && <Coins clock={clock} active={motion.active} />}
      </View>
      <Text testID="frame-result" style={{ color: designTokens.base['gold-soft'] }}>
        {!motion.active
          ? t('static')
          : measurement
            ? t('fps', {
                fps: measurement.fps.toFixed(2),
                ms: measurement.p95Ms.toFixed(2),
                target: targets[name],
              })
            : t('sampling')}
      </Text>
      {fallback && (
        <Text testID="sphere-fallback" style={{ color: designTokens.base['text-2'] }}>
          {t('fallback')}
        </Text>
      )}
      {name === 'sphere' && (
        <Pressable
          accessibilityRole="button"
          testID="force-fallback"
          onPress={() => {
            if (!fallback) fail();
          }}
        >
          <Text style={{ color: designTokens.base.gold }}>{t('forceFallback')}</Text>
        </Pressable>
      )}
      {name === 'particles' && (
        <View style={{ flexDirection: 'row', gap: spacing('space-4') }}>
          {(['sparkle', 'ink', 'stardust'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setPreset(value)}
              testID={`particles-${value}`}
            >
              <Text style={{ color: designTokens.base.gold }}>{t(value)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
