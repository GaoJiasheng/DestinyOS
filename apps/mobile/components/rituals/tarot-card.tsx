import { useEffect } from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { Canvas, RoundedRect, LinearGradient, vec } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  useDerivedValue,
} from 'react-native-reanimated';
import type { TarotChart } from '@tianji/shared';
import { designTokens } from '@tianji/ui-core/tokens';
import { tarotImages } from '../../lib/reports/tarot-images';
import { useCopy } from '../../lib/copy';
import { useChartLabel } from '../report/report-ui';
import { CopyText } from '../native-ui';
import { CardBack } from './card-back';
import { RitualBurst } from './cast-stage';
const gold = designTokens.base.gold;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Fly a selected back into its slot, then rotateY for 600ms and reverse only after the reveal. */
export function RitualCard({
  card,
  position,
  revealed,
  animate,
  onFlip,
  index,
  sideways = false,
}: {
  card?: TarotChart['cards'][number];
  position: string;
  revealed: boolean;
  animate: boolean;
  onFlip: () => void;
  index: number;
  sideways?: boolean;
}) {
  const t = useCopy(),
    label = useChartLabel();
  const flight = useSharedValue(animate ? 1 : 0),
    flip = useSharedValue(0),
    reversal = useSharedValue(0);
  useEffect(() => {
    flight.value = withTiming(0, { duration: animate ? 500 : 150, easing: ease });
  }, [flight, animate]);
  useEffect(() => {
    flip.value = withTiming(revealed ? 180 : 0, { duration: animate ? 600 : 0, easing: ease });
    reversal.value =
      revealed && card?.reversed
        ? withSequence(
            withTiming(0, { duration: animate ? 600 : 0 }),
            withTiming(180, { duration: animate ? 300 : 0, easing: ease }),
          )
        : 0;
  }, [revealed, animate, flip, reversal, card?.reversed]);
  const back = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value}deg` }],
  }));
  const front = useAnimatedStyle(() => ({
    opacity: flip.value >= 90 ? 1 : 0,
    transform: [
      { perspective: 900 },
      { rotateY: `${flip.value - 180}deg` },
      { rotateZ: `${reversal.value + (sideways ? 90 : 0)}deg` },
    ],
  }));
  const flying = useAnimatedStyle(() => ({
    opacity: 1 - flight.value * 0.5,
    transform: [
      { translateY: flight.value * 160 },
      { translateX: flight.value * (index % 2 ? 60 : -60) },
      { scale: 1 - flight.value * 0.35 },
    ],
  }));
  const glow = useDerivedValue(() => Math.sin((flip.value / 180) * Math.PI));
  const name = card ? label(`glossary.${card.cardKey}.term`) : '';
  const description = revealed
    ? t('tarot.cardLabel', {
        position,
        name,
        orientation: t(card?.reversed ? 'tarot.reversed' : 'tarot.upright'),
      })
    : t('tarot.flipCard', { position });
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <CopyText>{position}</CopyText>
      <Pressable
        testID={`tarot-flip-${index}`}
        accessibilityRole="button"
        accessibilityLabel={description}
        accessibilityState={{ disabled: revealed || !card }}
        disabled={revealed || !card}
        onPress={onFlip}
      >
        <Animated.View style={[{ width: 136, height: 238 }, flying]}>
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <CardBack width={136} height={238} />
          </Animated.View>
          {card ? (
            <Animated.View style={[StyleSheet.absoluteFill, front]}>
              <Image
                source={tarotImages[card.cardKey]}
                style={{ width: 136, height: 238, borderRadius: 6 }}
                resizeMode="contain"
              />
            </Animated.View>
          ) : null}
          <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
            <RoundedRect
              x={1}
              y={1}
              width={134}
              height={236}
              r={6}
              style="stroke"
              strokeWidth={3}
              opacity={glow}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(136, 238)}
                colors={[gold, designTokens.base['gold-soft'], gold]}
              />
            </RoundedRect>
          </Canvas>
          {revealed ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: -100, left: -102, width: 340, height: 340 }}
            >
              <RitualBurst animate={animate} preset="sparkle" />
            </View>
          ) : null}
        </Animated.View>
      </Pressable>
      {revealed ? <CopyText>{description}</CopyText> : null}
    </View>
  );
}
