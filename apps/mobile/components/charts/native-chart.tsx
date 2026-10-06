import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  useWindowDimensions,
  AccessibilityInfo,
  useColorScheme,
} from 'react-native';
import { SceneCanvas } from './scene-canvas';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../lib/theme';
import { useCopy } from '../../lib/copy';
import type { NativeChart } from '../../lib/reports/readings';
import {
  makeChartScene,
  nodesForEvidence,
  hitChart,
  chartPoint,
  type ChartNode,
  type ChartScene,
} from '../../lib/reports/chart-scene';
import { useChartLabel, ReportSheet, DataTree } from '../report/report-ui';
import { Action, CopyText } from '../native-ui';
import { Sphere } from '../effects/sphere';
import { useProfiles } from '../../lib/profiles';
import { useEffectsMotion } from '../effects/motion';

/** Skia chart viewport supports bounded pinch, pan, inverse hit testing and accessible buttons. */
export function NativeChartView({
  chart,
  highlight = '',
  onSelect,
  onRelated,
}: {
  chart: NativeChart;
  highlight?: string;
  onSelect: (node: ChartNode, scene: ChartScene) => void;
  onRelated?: (node: ChartNode, scene: ChartScene) => void;
}) {
  const t = useCopy(),
    label = useChartLabel(),
    { colors, body } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth - 64, 440);
  const [division, setDivision] = useState<'D1' | 'D9'>('D1'),
    [layout, setLayout] = useState<'south' | 'north'>('south'),
    [northUp, setNorthUp] = useState(false);
  const [selected, setSelected] = useState<ChartNode | null>(null),
    [table, setTable] = useState(false),
    [three, setThree] = useState(false),
    [failed3D, setFailed3D] = useState(false);
  const reduced = useProfiles().settings.reducedMotion;
  const motion = useEffectsMotion();
  const [systemReduced, setSystemReduced] = useState(false);
  useColorScheme();
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduced);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduced,
    );
    return () => subscription.remove();
  }, []);
  const scene = useMemo(
    () => makeChartScene(chart, label, { division, layout, northUp }),
    [chart, label, division, layout, northUp],
  );
  const height = (scene.height * width) / 400;
  const scale = useSharedValue(1),
    baseScale = useSharedValue(1),
    dx = useSharedValue(0),
    dy = useSharedValue(0),
    bx = useSharedValue(0),
    by = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: scale.value }],
  }));
  const select = (node: ChartNode) => {
    setSelected(node);
    onSelect(node, scene);
  };
  const tap = Gesture.Tap()
    .maxDuration(300)
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success) return;
      const found = hitChart(
        scene,
        chartPoint(event.x, event.y, width, height, scale.value, dx.value, dy.value),
      );
      if (found) select(found);
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      baseScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(3, baseScale.value * event.scale));
    })
    .onEnd(() => {
      dx.value = Math.max(
        (-width * (scale.value - 1)) / 2,
        Math.min((width * (scale.value - 1)) / 2, dx.value),
      );
      dy.value = Math.max(
        (-height * (scale.value - 1)) / 2,
        Math.min((height * (scale.value - 1)) / 2, dy.value),
      );
    });
  const pan = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      bx.value = dx.value;
      by.value = dy.value;
    })
    .onUpdate((event) => {
      dx.value = Math.max(
        (-width * (scale.value - 1)) / 2,
        Math.min((width * (scale.value - 1)) / 2, bx.value + event.translationX),
      );
      dy.value = Math.max(
        (-height * (scale.value - 1)) / 2,
        Math.min((height * (scale.value - 1)) / 2, by.value + event.translationY),
      );
    });
  function reset() {
    scale.value = 1;
    dx.value = 0;
    dy.value = 0;
  }
  const matched = nodesForEvidence(chart, scene, highlight);
  const selectedPaths = matched.map((n) => n.path);
  if (chart.system === 'ziwei' && matched[0])
    selectedPaths.splice(0, selectedPaths.length, ...(matched[0].related ?? []));
  const fail = useCallback(() => setFailed3D(true), []);
  const measured = useCallback(() => undefined, []);
  const show3D = chart.system === 'astrology' && three && !failed3D && !reduced && !systemReduced;
  return (
    <View testID={`chart-${chart.system}`} style={{ gap: 12 }}>
      {chart.system === 'vedic' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['D1', 'D9'] as const).map((d) => (
              <Action
                key={d}
                id={`vedic-${d}`}
                label={t(`charts.vedic.${d}`)}
                selected={division === d}
                onPress={() => {
                  reset();
                  setDivision(d);
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['south', 'north'] as const).map((l) => (
              <Action
                key={l}
                id={`vedic-${l}`}
                label={t(`charts.vedic.${l}`)}
                selected={layout === l}
                disabled={l === 'north' && chart.data.noonChart}
                onPress={() => {
                  reset();
                  setLayout(l);
                }}
              />
            ))}
          </View>
          <CopyText>
            {chart.data.noonChart
              ? t('charts.vedic.noon')
              : t('charts.vedic.moonMansion') +
                ' · ' +
                label(`charts.nakshatra.${chart.data.moon.nakshatra}`, chart.data.moon.nakshatra)}
          </CopyText>
        </>
      ) : null}
      {chart.system === 'astrology' ? (
        <>
          <Action
            id="chart-three"
            label={t('charts.natal.three')}
            selected={three}
            onPress={() => setThree((v) => !v)}
          />
          {chart.data.noonChart ? <CopyText>{t('charts.natal.noon')}</CopyText> : null}
          {three && !show3D ? (
            <CopyText testID="chart-three-fallback">{t('mobile.report.threeFallback')}</CopyText>
          ) : null}
        </>
      ) : null}
      {chart.system === 'qimen' ? (
        <Action
          id="chart-north-up"
          label={t('mobile.report.northUp')}
          selected={northUp}
          onPress={() => setNorthUp((v) => !v)}
        />
      ) : null}
      {chart.system === 'synastry' ? <CopyText>{t('synastry.wheel')}</CopyText> : null}
      <CopyText>{t('mobile.report.gesture')}</CopyText>
      <View
        style={{
          width,
          height: show3D ? width : height,
          overflow: 'hidden',
          backgroundColor: colors['bg-0'],
          borderRadius: 12,
          alignSelf: 'center',
        }}
      >
        {show3D && chart.system === 'astrology' ? (
          <Sphere
            chart={chart.data}
            size={width}
            active={motion.active && !reduced}
            onFailure={fail}
            onMeasured={measured}
          />
        ) : (
          <GestureDetector gesture={Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), tap)}>
            <View testID="chart-viewport" style={{ width, height }}>
              <Animated.View style={[{ width, height }, animated]}>
                <SceneCanvas scene={scene} width={width} selected={selectedPaths} />
              </Animated.View>
              <View
                testID="chart-midpoint"
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: height / 2,
                  left: width / 2,
                  width: 2,
                  height: 2,
                }}
              />
            </View>
          </GestureDetector>
        )}
      </View>
      {highlight ? (
        <CopyText testID="chart-highlight">
          {t('mobile.report.highlight', {
            value: matched.map((n) => n.label).join(' · ') || t('report.chart'),
          })}
        </CopyText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Action
          id="chart-zoom"
          label={t('ziwei.chart.zoom')}
          onPress={() => {
            scale.value = Math.min(3, scale.value + 0.5);
          }}
        />
        <Action id="chart-reset" label={t('ziwei.chart.reset')} onPress={reset} />
      </View>
      <Action
        id="chart-data"
        label={t('mobile.report.chartData')}
        onPress={() => setTable((v) => !v)}
      />
      {table ? (
        <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }}>
          {scene.nodes.map((n, i) => (
            <Action
              key={n.path}
              id={`chart-node-${i}`}
              label={label('report.content', [n.label, ...n.lines].join(' · '))}
              onPress={() => select(n)}
            />
          ))}
        </ScrollView>
      ) : null}
      {selected ? (
        <ReportSheet title={selected.label} id="chart-detail" close={() => setSelected(null)}>
          <Text selectable style={{ color: colors['text-1'], fontFamily: body, fontSize: 18 }}>
            {label('report.content', selected.lines.join(' · '))}
          </Text>
          <DataTree value={selected.detail} />
          <Action
            id="chart-related"
            label={t('ziwei.chart.readSection')}
            onPress={() => {
              onRelated?.(selected, scene);
              setSelected(null);
            }}
          />
        </ReportSheet>
      ) : null}
    </View>
  );
}
