import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { TAROT_SPREADS, type SpreadKey } from '@tianji/shared';
import { designTokens } from '@tianji/ui-core/tokens';
import { useCopy } from '../../lib/copy';
import { CopyText, Action } from '../native-ui';
import { CardBack } from './card-back';
export { RitualCard } from './tarot-card';
const gold = designTokens.base.gold;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Thirty-two proxy cards shuffle on the UI thread; drag to split into three reorderable stacks. */
export function DeckStage({
  count,
  cut,
  split,
  animate,
  disabled,
  shuffle,
  onSplit,
  order,
  onPile,
}: {
  count: number;
  cut: boolean;
  split: boolean;
  animate: boolean;
  disabled: boolean;
  shuffle: () => void;
  onSplit: () => void;
  order: number[];
  onPile: (index: number) => void;
}) {
  const t = useCopy();
  const drag = useSharedValue(0);
  const dragged = useAnimatedStyle(() => ({ transform: [{ translateX: drag.value }] }));
  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      if (cut && !split && animate) drag.value = e.translationX;
    })
    .onEnd((e) => {
      drag.value = withTiming(0, { duration: 180 });
      if (!disabled && Math.abs(e.translationX) > 35) scheduleOnRN(cut ? onSplit : shuffle);
    });
  return (
    <GestureDetector gesture={pan}>
      <View testID={cut ? 'tarot-cut-stage' : 'tarot-shuffle-stage'} style={styles.deck}>
        {split
          ? [0, 1, 2].map((i) => (
              <Pressable
                key={i}
                testID={`tarot-pile-${i}`}
                disabled={order.includes(i)}
                accessibilityRole="button"
                accessibilityState={{ disabled: order.includes(i) }}
                accessibilityLabel={t('tarot.pile', { number: i + 1 })}
                onPress={() => onPile(i)}
                style={{ opacity: order.includes(i) ? 0.35 : 1, margin: 12 }}
              >
                <CardBack width={78} height={136} />
                <CopyText>{t('tarot.pile', { number: i + 1 })}</CopyText>
              </Pressable>
            ))
          : Array.from({ length: 32 }, (_, i) => (
              <Animated.View
                key={i}
                style={[
                  StyleSheet.absoluteFill,
                  { alignItems: 'center', justifyContent: 'center' },
                  i === 31 && dragged,
                ]}
                pointerEvents="none"
              >
                <ProxyCard index={i} count={count} animate={animate} />
              </Animated.View>
            ))}
      </View>
    </GestureDetector>
  );
}
function ProxyCard({ index, count, animate }: { index: number; count: number; animate: boolean }) {
  const phase = useSharedValue(0);
  useEffect(() => {
    if (!count || !animate) return;
    phase.value = withSequence(
      withTiming(1, { duration: 230, easing: ease }),
      withTiming(0, { duration: 300, easing: ease }),
    );
  }, [count, animate, phase]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (index % 2 ? 1 : -1) * phase.value * (35 + index * 2) + index * 0.3 },
      { translateY: -index * 0.65 - phase.value * (index % 7) * 4 },
      { rotateZ: `${phase.value * (index - 15) * 2}deg` },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <CardBack width={100} height={175} />
    </Animated.View>
  );
}
/** Virtualized 140-degree fan; horizontal native pan advances a bounded window of 25 cards. */
export function TarotFan({
  picked,
  onPick,
  animate,
  disabled,
}: {
  picked: number[];
  onPick: (i: number) => void;
  animate: boolean;
  disabled: boolean;
}) {
  const t = useCopy();
  const [start, setStart] = useState(0);
  const drift = useSharedValue(0);
  function move(delta: number) {
    setStart((v) => Math.max(0, Math.min(53, v + delta)));
  }
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      drift.value = animate ? e.translationX * 0.1 : 0;
    })
    .onEnd((e) => {
      drift.value = withTiming(0, { duration: 150 });
      if (Math.abs(e.translationX) > 20) scheduleOnRN(move, e.translationX < 0 ? 12 : -12);
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value }] }));
  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View testID="tarot-fan" style={[styles.fan, style]}>
          {Array.from({ length: 25 }, (_, i) => {
            const index = start + i,
              a = (i / 24 - 0.5) * 140,
              radians = (a * Math.PI) / 180;
            return (
              <Pressable
                key={index}
                testID={`tarot-pick-${index}`}
                accessibilityRole="button"
                accessibilityLabel={t('tarot.pickCard', { number: index + 1 })}
                accessibilityState={{ disabled: disabled || picked.includes(index) }}
                disabled={disabled || picked.includes(index)}
                onPress={() => onPick(index)}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 18,
                  marginLeft: -26,
                  opacity: picked.includes(index) ? 0.15 : 1,
                  transform: [
                    { translateX: Math.sin(radians) * 135 },
                    { translateY: (1 - Math.cos(radians)) * 135 },
                    { rotateZ: `${a}deg` },
                  ],
                }}
              >
                <CardBack width={52} height={92} />
              </Pressable>
            );
          })}
        </Animated.View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Action
            id="tarot-fan-prev"
            label={t('tarot.previousCards')}
            disabled={start === 0 || disabled}
            onPress={() => move(-12)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Action
            id="tarot-fan-next"
            label={t('tarot.nextCards')}
            disabled={start === 53 || disabled}
            onPress={() => move(12)}
          />
        </View>
      </View>
    </>
  );
}
/** Documented spread coordinates remain shared, including the sideways Celtic challenge. */
export function SpreadThumbnail({ spread, filled = 0 }: { spread: SpreadKey; filled?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 110, width: '100%' }}
    >
      {TAROT_SPREADS[spread].map((p, i) => (
        <View
          key={p.key}
          style={{
            position: 'absolute',
            left: `${p.x * 90}%`,
            top: p.y * 75,
            width: 20,
            height: 32,
            borderWidth: 1,
            borderStyle: i < filled ? 'solid' : 'dashed',
            borderColor: gold,
            backgroundColor: i < filled ? designTokens.west.accent : 'transparent',
            transform: [{ rotateZ: `${p.rotation}deg` }],
          }}
        />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  deck: { height: 240, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  fan: { height: 220, width: '100%', overflow: 'hidden' },
});
