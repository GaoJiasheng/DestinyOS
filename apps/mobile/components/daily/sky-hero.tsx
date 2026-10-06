import { spacing } from '@tianji/ui-core/tokens';
import { useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { brand } from '@tianji/shared/brand';
import { useCopy } from '../../lib/copy';
import { useChartLabel } from '../report/report-ui';
import { usePreferences } from '../../lib/preferences';
import { useProfiles } from '../../lib/profiles';
import { Starfield } from '../effects/starfield';
import { useEffectsMotion } from '../effects/motion';
import { CopyText } from '../native-ui';
// DESIGN-GAP: With no authorized location stored by the native settings task, use the disclosed UTC 0° sky without requesting GPS.
/** Current BSC5 sky with motion-aware gyroscope parallax. */
export function SkyHero({ visible = true }: { visible?: boolean }) {
  const t = useCopy(),
    label = useChartLabel();
  const size = Math.min(useWindowDimensions().width - 48, 500);
  const { active } = useEffectsMotion(),
    focused = useIsFocused();
  const { settings } = useProfiles();
  const animate = active && focused && visible && !settings.reducedMotion;
  const clock = useSharedValue(0);
  useFrameCallback((frame) => {
    if (animate) clock.value += frame.timeSincePreviousFrame ?? 0;
  });
  const locale = usePreferences((s) => s.locale);
  return (
    <View testID="home-sky" style={{ gap: spacing('space-3'), alignItems: 'center' }}>
      <Starfield
        size={size}
        clock={clock}
        active={animate}
        labels={Object.fromEntries(
          ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((p) => [
            p,
            label(`charts.planet.${p}`),
          ]),
        )}
        now={new Date()}
        place={{ lat: 0, lng: 0 }}
        parallax={true}
        diagnostics={false}
      />
      <CopyText title>
        {t(locale === 'en' ? 'brand.nameEn' : 'brand.nameZh', {
          name: locale === 'en' ? brand.nameEn : locale === 'zh-TW' ? brand.nameZhTW : brand.nameZh,
        })}
      </CopyText>
      <CopyText>{t('brand.tagline')}</CopyText>
      <CopyText>{t('home.sky.origin')}</CopyText>
    </View>
  );
}
