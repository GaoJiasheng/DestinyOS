import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Circle, Rect, Group, vec } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import type { IchingChart, QimenChart } from '@tianji/shared';
import { designTokens } from '@tianji/ui-core/tokens';
import { useTheme } from '../../lib/theme';
import { useCopy } from '../../lib/copy';
import { useChartLabel } from '../report/report-ui';
import { Action, CopyText } from '../native-ui';
import { Particles, type ParticlePreset } from '../effects/particles';
import type { CoinCount } from '../../lib/rituals/model';
const gold = designTokens.base.gold;
/** Three result-driven 3D coins land with damped rebounds; faces match the saved head count. */
export function CoinThrow({
  heads,
  animate,
  duration = 1200,
  trigger = 0,
}: {
  heads: CoinCount;
  animate: boolean;
  duration?: number;
  trigger?: number;
}) {
  const t = useCopy();
  return (
    <View
      style={{
        height: 190,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 14,
      }}
    >
      {[0, 1, 2].map((i) => (
        <ResultCoin
          key={i}
          index={i}
          head={i < heads}
          animate={animate}
          duration={duration}
          trigger={trigger}
        />
      ))}
      <View accessibilityElementsHidden style={{ position: 'absolute', bottom: -28 }}>
        <CopyText>{t('divination.coinInscription')}</CopyText>
      </View>
    </View>
  );
}
function ResultCoin({
  index,
  head,
  animate,
  duration,
  trigger,
}: {
  index: number;
  head: boolean;
  animate: boolean;
  duration: number;
  trigger: number;
}) {
  const progress = useSharedValue(animate ? 0 : 1);
  const { colors } = useTheme();
  useEffect(() => {
    progress.value = animate ? 0 : 1;
    progress.value = withTiming(1, { duration: animate ? duration : 0, easing: Easing.linear });
  }, [animate, duration, progress, trigger]);
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, progress.value * (1 + index * 0.04));
    const y =
      t < 0.55
        ? -150 * (1 - (t / 0.55) ** 2)
        : -Math.abs(Math.sin((t - 0.55) * 23)) * 34 * Math.exp(-(t - 0.55) * 9);
    return {
      transform: [
        { perspective: 700 },
        { translateY: y },
        { rotateX: `${Math.min(1, t / 0.55) * (head ? 720 : 900)}deg` },
        { rotateZ: `${index * 25}deg` },
      ],
    };
  });
  return (
    <Animated.View style={style}>
      <Canvas style={{ width: 76, height: 76 }}>
        <Circle cx={38} cy={38} r={36} color={gold} />
        <Circle cx={38} cy={38} r={32} color={colors['bg-0']} style="stroke" strokeWidth={2} />
        <Rect x={29} y={29} width={18} height={18} color={colors['bg-0']} />
        {[0, 1, 2, 3].map((i) => (
          <Group key={i} origin={vec(38, 38)} transform={[{ rotate: (i * Math.PI) / 2 }]}>
            {head ? (
              <>
                <Rect x={35} y={11} width={5} height={12} color={colors['bg-0']} />
                <Rect x={31} y={15} width={14} height={2} color={colors['bg-0']} />
              </>
            ) : (
              <>
                <Circle
                  cx={38}
                  cy={17}
                  r={5}
                  color={colors['bg-0']}
                  style="stroke"
                  strokeWidth={2}
                />
                <Rect x={35} y={21} width={2} height={5} color={colors['bg-0']} />
              </>
            )}
          </Group>
        ))}
      </Canvas>
    </Animated.View>
  );
}
/** Finite 80-sprite burst reuses the M02 GPU particle system and stops at 900ms. */
export function RitualBurst({
  animate,
  preset,
  trigger = 0,
}: {
  animate: boolean;
  preset: ParticlePreset;
  trigger?: number;
}) {
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value = 0;
    if (animate) clock.value = withTiming(900, { duration: 900, easing: Easing.linear });
  }, [clock, animate, trigger]);
  const style = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - clock.value / 900) }));
  if (!animate) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, style]}
    >
      <Particles size={340} clock={clock} preset={preset} />
    </Animated.View>
  );
}
/** Bottom-up GPU line drawing with halos around moving lines. */
export function HexagramLines({
  lines,
  moving,
  animate,
}: {
  lines: number[];
  moving: number[];
  animate: boolean;
}) {
  const t = useCopy();
  return (
    <View style={{ height: 170, justifyContent: 'center', gap: 16, alignItems: 'center' }}>
      {[5, 4, 3, 2, 1, 0].map((i) => (
        <View
          key={i}
          style={{ height: 12 }}
          accessibilityLabel={t('divination.lineLabel', {
            position: i + 1,
            type: t(lines[i] ? 'divination.yang' : 'divination.yin'),
            moving: t(moving.includes(i + 1) ? 'divination.moving' : 'divination.static'),
          })}
          accessible={lines[i] !== undefined}
        >
          <DrawLine
            yang={lines[i] === 1}
            visible={lines[i] !== undefined}
            moving={moving.includes(i + 1)}
            animate={animate}
          />
        </View>
      ))}
    </View>
  );
}
function DrawLine({
  yang,
  visible,
  moving,
  animate,
}: {
  yang: boolean;
  visible: boolean;
  moving: boolean;
  animate: boolean;
}) {
  const progress = useSharedValue(visible && !animate ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: animate ? 450 : 150 });
  }, [visible, animate, progress]);
  const width = useDerivedValue(() => (yang ? 200 : 85) * progress.value);
  const angle = useDerivedValue(() => [{ rotate: progress.value * Math.PI * 2 }]);
  return (
    <Canvas style={{ width: 220, height: 14 }}>
      <Rect x={10} y={5} width={width} height={4} color={gold} />
      {!yang ? <Rect x={125} y={5} width={width} height={4} color={gold} /> : null}
      {moving && visible ? (
        <Group origin={vec(210, 7)} transform={angle}>
          <Circle
            cx={210}
            cy={7}
            r={6}
            color={gold}
            style="stroke"
            strokeWidth={1}
            opacity={progress}
          />
          <Circle cx={210} cy={1} r={1} color={gold} />
        </Group>
      ) : null}
    </Canvas>
  );
}
/** Flip from primary to changing hexagram without altering the saved reading. */
export function HexagramResult({ chart, animate }: { chart: IchingChart; animate: boolean }) {
  const t = useCopy();
  const [changing, setChanging] = useState(false);
  const flip = useSharedValue(0);
  useEffect(() => {
    flip.value = withTiming(changing ? 180 : 0, { duration: animate ? 600 : 0 });
  }, [changing, animate, flip]);
  const primaryStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value}deg` }],
  }));
  const changedStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value - 180}deg` }],
  }));
  return (
    <View testID="ritual-hexagram" style={{ gap: 12 }}>
      <CopyText title>{t(changing ? 'divination.changing' : 'divination.primary')}</CopyText>
      <CopyText>
        {t('divination.hexagramLabel', {
          number: (changing ? chart.changing : chart.primary)?.number ?? chart.primary.number,
        })}
      </CopyText>
      <View style={{ height: 170 }}>
        <Animated.View style={[StyleSheet.absoluteFill, primaryStyle]}>
          <HexagramLines lines={chart.primary.lines} moving={chart.movingLines} animate={animate} />
        </Animated.View>
        {chart.changing ? (
          <Animated.View style={[StyleSheet.absoluteFill, changedStyle]}>
            <HexagramLines lines={chart.changing.lines} moving={[]} animate={animate} />
          </Animated.View>
        ) : null}
      </View>
      {chart.changing ? (
        <Action
          id="ritual-change"
          label={t(changing ? 'divination.primary' : 'divination.changing')}
          onPress={() => setChanging((v) => !v)}
        />
      ) : null}
    </View>
  );
}
/** South-up Lo Shu square: each of the four documented layers lights in a nine-palace cadence. */
export function QimenLighting({
  chart,
  beat,
  animate,
}: {
  chart: QimenChart;
  beat: number;
  animate: boolean;
}) {
  return (
    <View testID="ritual-nine-palaces" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {[4, 9, 2, 3, 5, 7, 8, 1, 6].map((number, order) => (
        <Palace
          key={number}
          palace={chart.palaces[number - 1]!}
          layer={Math.max(0, Math.min(4, Math.floor((beat - order - 1) / 9) + 1))}
          animate={animate}
        />
      ))}
    </View>
  );
}
function Palace({
  palace,
  layer,
  animate,
}: {
  palace: QimenChart['palaces'][number];
  layer: number;
  animate: boolean;
}) {
  const label = useChartLabel(),
    { colors } = useTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(layer ? 1 : 0.15, { duration: animate ? 300 : 150 });
  }, [layer, animate, progress]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View
      style={[
        {
          width: '31%',
          minHeight: 180,
          padding: 8,
          borderWidth: 1,
          borderColor: layer ? gold : colors['line-1'],
          backgroundColor: colors['surface-1'],
          gap: 8,
        },
        style,
      ]}
    >
      <CopyText>{label(`divination.directions.${palace.direction}`, palace.direction)}</CopyText>
      {layer >= 1 ? <CopyText>{label(`glossary.stem.${palace.earthStem}.term`)}</CopyText> : null}
      {layer >= 2 ? (
        <>
          <CopyText>{label(`glossary.stem.${palace.skyStem}.term`)}</CopyText>
          <CopyText>{label(`divination.symbols.${palace.star}`)}</CopyText>
        </>
      ) : null}
      {layer >= 3 && palace.gate ? (
        <CopyText>{label(`divination.symbols.${palace.gate}`)}</CopyText>
      ) : null}
      {layer >= 4 && palace.deity ? (
        <CopyText>{label(`divination.symbols.${palace.deity}`)}</CopyText>
      ) : null}
    </Animated.View>
  );
}
