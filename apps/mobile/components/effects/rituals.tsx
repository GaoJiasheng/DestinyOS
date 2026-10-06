import foolCard from '../../../web/public/tarot/rws/major_00_fool.webp';
import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Canvas,
  RoundedRect,
  LinearGradient,
  vec,
  Circle,
  Rect,
  Group,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { designTokens } from '@tianji/ui-core/tokens';
const gold = designTokens.base.gold,
  bg = designTokens.base['bg-0'];
const ease = Easing.bezier(0.2, 0.8, 0.2, 1).factory();
const haptic = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};
/** 600ms perspective flip, Skia edge glow, then a 300ms reversed orientation. */
export function TarotFlip({ clock, active }: { clock: SharedValue<number>; active: boolean }) {
  const cycle = useDerivedValue(() => clock.value % 3000);
  const rotation = useDerivedValue(() => ease(Math.min(1, cycle.value / 600)) * 180);
  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${rotation.value}deg` },
      { rotateZ: `${Math.min(1, Math.max(0, (cycle.value - 600) / 300)) * 180}deg` },
    ],
  }));
  const back = useAnimatedStyle(() => ({ opacity: rotation.value < 90 ? 1 : 0 }));
  const front = useAnimatedStyle(() => ({
    opacity: rotation.value >= 90 ? 1 : 0,
    transform: [{ rotateY: '180deg' }],
  }));
  const glow = useDerivedValue(() => Math.sin((rotation.value * Math.PI) / 180));
  useAnimatedReaction(
    () => Math.floor(clock.value / 3000),
    (value, previous) => {
      if (active && previous !== null && value !== previous) scheduleOnRN(haptic);
    },
  );
  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.card, style]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.cardBack, back]}>
          <Canvas style={StyleSheet.absoluteFill}>
            <RoundedRect
              x={10}
              y={10}
              width={160}
              height={280}
              r={8}
              color={gold}
              style="stroke"
              strokeWidth={1}
            />
            <Circle cx={90} cy={150} r={55} color={gold} style="stroke" strokeWidth={1} />
            <Group origin={vec(90, 150)} transform={[{ rotate: Math.PI / 4 }]}>
              <Rect
                x={55}
                y={115}
                width={70}
                height={70}
                color={gold}
                style="stroke"
                strokeWidth={1}
              />
            </Group>
          </Canvas>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, front]}>
          <Image source={foolCard} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <RoundedRect
            x={1}
            y={1}
            width={178}
            height={298}
            r={10}
            style="stroke"
            strokeWidth={3}
            opacity={glow}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(180, 300)}
              colors={[gold, designTokens.base['gold-soft'], gold]}
            />
          </RoundedRect>
        </Canvas>
      </Animated.View>
    </View>
  );
}
/** Three independent perspective coins with gravity and damped rebounds, square holes and impact haptics. */
export function Coins({ clock, active }: { clock: SharedValue<number>; active: boolean }) {
  useEffect(() => {
    if (active) haptic();
  }, [active]);
  return (
    <View style={styles.stage}>
      {[0, 1, 2].map((index) => (
        <Coin key={index} clock={clock} index={index} active={active} />
      ))}
    </View>
  );
}
function Coin({
  clock,
  index,
  active,
}: {
  clock: SharedValue<number>;
  index: number;
  active: boolean;
}) {
  const t = useDerivedValue(() => Math.max(0, ((clock.value + index * 90) % 2400) / 1000));
  const style = useAnimatedStyle(() => {
    const fall =
      t.value < 0.65
        ? -180 + 180 * (t.value / 0.65) ** 2
        : -Math.abs(Math.sin((t.value - 0.65) * 11)) * 65 * Math.exp(-(t.value - 0.65) * 4);
    return {
      transform: [
        { perspective: 700 },
        { translateY: fall },
        { rotateX: `${t.value < 0.65 ? t.value * 1100 : 720}deg` },
        { rotateY: `${index * 12}deg` },
        { rotateZ: `${index * 31 + t.value * 40}deg` },
      ],
    };
  });
  useAnimatedReaction(
    () => t.value >= 0.65,
    (landed, before) => {
      if (active && landed && before === false) scheduleOnRN(haptic);
    },
  );
  return (
    <Animated.View style={[styles.coin, style]}>
      <Canvas style={{ width: 84, height: 84 }}>
        <Circle cx={42} cy={42} r={40} color={gold} />
        <Circle cx={42} cy={42} r={35} color={bg} style="stroke" strokeWidth={2} />
        <Rect x={32} y={32} width={20} height={20} color={bg} />
        {[0, 1, 2, 3].map((i) => (
          <Group key={i} origin={vec(42, 42)} transform={[{ rotate: (i * Math.PI) / 2 }]}>
            <Rect x={39} y={11} width={6} height={13} color={bg} />
            <Rect x={34} y={17} width={16} height={2} color={bg} />
          </Group>
        ))}
      </Canvas>
    </Animated.View>
  );
}
// DESIGN-GAP: Developer stages use fixed physical scene sizes; responsive hosts center them without scaling text.
const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 14 },
  card: { width: 180, height: 300, borderRadius: 10, overflow: 'hidden' },
  cardBack: { backgroundColor: designTokens.west.accent },
  coin: { width: 84, height: 84 },
});
