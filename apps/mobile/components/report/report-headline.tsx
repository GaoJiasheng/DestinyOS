import { useEffect } from 'react';
import { useSharedValue, withTiming, ReduceMotion } from 'react-native-reanimated';
import { useProfiles } from '../../lib/profiles';
import { View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { SCORE_DIMENSIONS, radarPoint } from '@tianji/ui-core';
import type { Report } from '@tianji/interpret';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { ReportCard } from './report-ui';
import { CopyText } from '../native-ui';
/** Shared five-dimension radar geometry with a text alternative and confidence bar. */
export function ReportHeadline({ headline }: { headline: Report['headline'] }) {
  const t = useCopy(),
    { colors } = useTheme();
  const reduced = useProfiles().settings.reducedMotion;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduced
      ? 1
      : withTiming(1, { duration: 500, reduceMotion: ReduceMotion.System });
  }, [headline, reduced, progress]);
  function polygon(radius: (index: number) => number) {
    const path = Skia.Path.Make();
    SCORE_DIMENSIONS.forEach((_, i) => {
      const [x, y] = radarPoint(i, radius(i), [70, 70]);
      if (i) path.lineTo(x, y);
      else path.moveTo(x, y);
    });
    path.close();
    return path;
  }
  return (
    <ReportCard id="report-headline">
      <CopyText title>{t('report.content', { text: headline.persona })}</CopyText>
      <CopyText>{t('report.content', { text: headline.keywords.join(' · ') })}</CopyText>
      <View style={{ alignSelf: 'center' }} accessible accessibilityLabel={t('report.radar')}>
        <Canvas style={{ width: 140, height: 140 }}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Path
              key={level}
              path={polygon(() => level * 12)}
              color={colors['line-2']}
              style="stroke"
              strokeWidth={1}
            />
          ))}
          <Path
            path={polygon((i) => headline.scores[SCORE_DIMENSIONS[i]!] * 12)}
            color={colors.gold + '44'}
            opacity={progress}
          />
          <Path
            path={polygon((i) => headline.scores[SCORE_DIMENSIONS[i]!] * 12)}
            color={colors.gold}
            style="stroke"
            strokeWidth={2}
            end={progress}
          />
        </Canvas>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {SCORE_DIMENSIONS.map((dim) => (
          <CopyText key={dim}>
            {t(`report.dim.${dim}`) + ' ' + '★'.repeat(headline.scores[dim])}
          </CopyText>
        ))}
      </View>
      <CopyText>
        {t('report.confidence', { percent: Math.round(headline.confidence * 100) })}
      </CopyText>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(headline.confidence * 100) }}
        style={{ height: 5, backgroundColor: colors['line-1'], borderRadius: 3 }}
      >
        <View
          style={{
            width: `${headline.confidence * 100}%`,
            height: 5,
            backgroundColor: colors.gold,
            borderRadius: 3,
          }}
        />
      </View>
    </ReportCard>
  );
}
