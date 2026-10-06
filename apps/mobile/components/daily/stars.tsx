import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { designTokens, nativeTypography } from '@tianji/ui-core/tokens';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { useProfiles } from '../../lib/profiles';
import { useEffectsMotion } from '../effects/motion';
/** Five gold stars fill sequentially; screen readers receive one localized rating. */
export function DailyStars({ count }: { count: number }) {
  const t = useCopy(),
    { colors } = useTheme(),
    { active } = useEffectsMotion(),
    { settings } = useProfiles();
  const progress = useSharedValue(0),
    animate = active && !settings.reducedMotion;
  useEffect(() => {
    progress.value = animate
      ? withDelay(
          parseInt(designTokens.motion['stagger-max']),
          withTiming(count, { duration: parseInt(designTokens.motion['duration-enter-max']) }),
        )
      : count;
  }, [animate, count, progress]);
  const fill = useAnimatedStyle(() => ({ width: progress.value * 28 }));
  const star = t('report.content', { text: '★' });
  const row = (color: string) => (
    <View style={{ width: 140, flexDirection: 'row' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Text
          key={i}
          style={{ width: 28, textAlign: 'center', fontSize: nativeTypography.h2, color }}
        >
          {star}
        </Text>
      ))}
    </View>
  );
  return (
    <View
      accessible
      accessibilityLabel={t('daily.stars', { count })}
      style={{ width: 140, height: 36, justifyContent: 'center' }}
    >
      <View accessibilityElementsHidden>{row(colors['line-2'])}</View>
      <Animated.View
        accessibilityElementsHidden
        style={[{ position: 'absolute', overflow: 'hidden', height: 36 }, fill]}
      >
        {row(colors.gold)}
      </Animated.View>
    </View>
  );
}
