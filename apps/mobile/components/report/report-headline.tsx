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
import { isDivination } from '../../lib/reports/launch';

/** A radar of five identical scores carries no information. */
export function hasScoreSpread(scores: Report['headline']['scores']): boolean {
  return new Set(SCORE_DIMENSIONS.map((dimension) => scores[dimension])).size > 1;
}
/** Shared five-dimension radar geometry with a text alternative and confidence bar.
 * Divination draws have no natal profile, so scores and confidence are omitted for them;
 * any report whose five scores are identical omits the radar and stars. */
export function ReportHeadline({
  headline,
  system,
}: {
  headline: Report['headline'];
  system: string;
}) {
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
  const divination = isDivination(system),
    showScores = !divination && hasScoreSpread(headline.scores);
  const starLabel = (dim: (typeof SCORE_DIMENSIONS)[number]) =>
    t('mobile.report.stars', { dimension: t(`report.dim.${dim}`), count: headline.scores[dim] });
  const percent = Math.round(headline.confidence * 100);
  return (
    <ReportCard id="report-headline">
      <CopyText title>{t('report.content', { text: headline.persona })}</CopyText>
      <CopyText>{t('report.content', { text: headline.keywords.join(' · ') })}</CopyText>
      {showScores ? (
        <>
          <View
            style={{ alignSelf: 'center' }}
            accessible
            accessibilityLabel={t('mobile.report.radarLabel', {
              scores: SCORE_DIMENSIONS.map(starLabel).join(t('mobile.report.listSeparator')),
            })}
          >
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
              <View key={dim} accessible accessibilityLabel={starLabel(dim)}>
                <CopyText>
                  {t(`report.dim.${dim}`) + ' ' + '★'.repeat(headline.scores[dim])}
                </CopyText>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {divination ? null : (
        <>
          <CopyText>{t('report.confidence', { percent })}</CopyText>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
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
        </>
      )}
    </ReportCard>
  );
}
