import { useEffect } from 'react';
import {
  useSharedValue,
  withTiming,
  ReduceMotion,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useProfiles } from '../../lib/profiles';
import {
  Canvas,
  Group,
  Rect,
  Circle,
  Path,
  Text as SkiaText,
  useFont,
  Skia,
  Image,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useTheme } from '../../lib/theme';
import type { Shape, ChartScene } from '../../lib/reports/chart-scene';
import noto from '../../assets/fonts/noto.ttf';
import symbols from '../../assets/fonts/symbols.ttf';
import { tarotImages } from '../../lib/reports/tarot-images';
import type { ChartNode } from '../../lib/reports/chart-primitives';
/** GPU chart drawing; text is embedded OFL Noto, and shared geometry stays platform-free. */
export function SceneCanvas({
  scene,
  width,
  selected = [],
}: {
  scene: ChartScene;
  width: number;
  selected?: string[];
}) {
  const { colors } = useTheme();
  const font = useFont(noto, 13),
    small = useFont(noto, 11),
    compact = useFont(noto, 9),
    symbolFont = useFont(symbols, 17),
    sunFont = useFont(noto, 17);
  const factor = width / 400;
  const reduced = useProfiles().settings.reducedMotion;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = reduced
      ? 1
      : withTiming(1, { duration: 650, reduceMotion: ReduceMotion.System });
  }, [scene, reduced, progress]);
  const color = (token: string) => colors[token as keyof typeof colors] ?? colors.gold;
  return (
    <Canvas testID="skia-chart" style={{ width, height: scene.height * factor }}>
      <Group transform={[{ scale: factor }]}>
        {scene.shapes.map((shape, i) => (
          <ChartShape key={i} shape={shape} color={color(shape.color)} progress={progress} />
        ))}
        {selected.length === 4 && selected.every((path) => path.startsWith('palaces.'))
          ? (() => {
              const points = selected
                .map((path) => scene.nodes.find((node) => node.path === path))
                .filter((node) => node !== undefined)
                .map((node) => ({
                  x: node.bounds.x + node.bounds.width / 2,
                  y: node.bounds.y + node.bounds.height / 2,
                }));
              if (points.length !== 4) return null;
              return (
                <>
                  <ChartShape
                    shape={{
                      type: 'path',
                      points: points.slice(0, 3),
                      closed: true,
                      color: 'gold',
                    }}
                    color={colors.gold}
                  />
                  <ChartShape
                    shape={{ type: 'path', points: [points[0]!, points[3]!], color: 'gold' }}
                    color={colors.gold}
                  />
                </>
              );
            })()
          : null}
        {scene.nodes.map((node, index) => {
          const b = node.bounds,
            active = selected.includes(node.path),
            labelFont = node.glyph
              ? node.displayLabel === '☉'
                ? sunFont
                : symbolFont
              : b.width < 42
                ? compact
                : b.width < 80
                  ? small
                  : font,
            lineFont = b.width < 80 ? compact : small;
          const fit = (text: string, f: NonNullable<typeof font>, max: number) => {
            if (f.measureText(text).width <= max) return text;
            let chars = [...text];
            while (chars.length && f.measureText(chars.join('') + '…').width > max)
              chars = chars.slice(0, -1);
            return chars.join('') + '…';
          };
          return (
            <Reveal
              key={node.path}
              progress={progress}
              index={index}
              count={scene.nodes.length}
              rise={scene.height === 510}
              origin={vec(b.x, b.y + b.height)}
            >
              {node.cardKey ? <CardImage node={node} /> : null}
              {active ? (
                node.polygon ? (
                  <ChartShape
                    shape={{
                      type: 'path',
                      points: node.polygon,
                      closed: true,
                      color: 'gold',
                      fill: true,
                    }}
                    color={colors.gold + '33'}
                  />
                ) : (
                  <Rect
                    x={b.x + 1}
                    y={b.y + 1}
                    width={b.width - 2}
                    height={b.height - 2}
                    color={colors.gold + '33'}
                  />
                )
              ) : null}
              {labelFont ? (
                <SkiaText
                  x={
                    node.glyph && node.point
                      ? node.point.x -
                        labelFont.measureText(node.displayLabel ?? node.label).width / 2
                      : b.x + 5
                  }
                  y={
                    node.glyph && node.point
                      ? node.point.y + (node.lines.length ? -6 : 5)
                      : b.y + (node.cardKey ? 131 : 20)
                  }
                  text={fit(node.displayLabel ?? node.label, labelFont, b.width - 10)}
                  font={labelFont}
                  color={active ? colors.gold : colors['text-1']}
                />
              ) : null}
              {lineFont
                ? (node.displayLines ?? node.lines)
                    .slice(0, 4)
                    .map((text, i) => (
                      <SkiaText
                        key={i}
                        x={b.x + 5}
                        y={b.y + (node.cardKey ? 149 : 38) + i * 18}
                        text={fit(text, lineFont, b.width - 10)}
                        font={lineFont}
                        color={colors['text-2']}
                      />
                    ))
                : null}
            </Reveal>
          );
        })}
      </Group>
    </Canvas>
  );
}
function CardImage({ node }: { node: ChartNode }) {
  const image = useImage(node.cardKey ? tarotImages[node.cardKey] : null);
  const b = node.bounds;
  return image ? (
    <Group
      origin={vec(b.x + b.width / 2, b.y + b.height / 2)}
      transform={[{ rotate: ((node.rotation ?? 0) * Math.PI) / 180 }]}
    >
      <Image image={image} x={b.x} y={b.y} width={b.width} height={b.height} fit="cover" />
    </Group>
  ) : null;
}
function Reveal({
  progress,
  index,
  count,
  rise,
  origin,
  children,
}: {
  progress: SharedValue<number>;
  index: number;
  count: number;
  rise: boolean;
  origin: ReturnType<typeof vec>;
  children: import('react').ReactNode;
}) {
  const opacity = useDerivedValue(() =>
    Math.min(1, Math.max(0, progress.value * (count + 2) - index)),
  );
  const transform = useDerivedValue(() => [{ translateY: rise ? (1 - opacity.value) * 25 : 0 }]);
  return (
    <Group opacity={opacity} transform={transform} origin={origin}>
      {children}
    </Group>
  );
}
function ChartShape({
  shape,
  color,
  progress,
}: {
  shape: Shape;
  color: string;
  progress?: SharedValue<number>;
}) {
  if (shape.type === 'rect')
    return (
      <Rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        color={color}
        style={shape.fill ? 'fill' : 'stroke'}
        strokeWidth={1}
      />
    );
  if (shape.type === 'circle')
    return (
      <Circle
        cx={shape.x}
        cy={shape.y}
        r={shape.radius}
        color={color}
        style={shape.fill ? 'fill' : 'stroke'}
        strokeWidth={1.2}
      />
    );
  const path = Skia.Path.Make();
  if (shape.type === 'arc')
    path.addArc({ x: 30, y: 198, width: 152, height: 152 }, shape.start, shape.sweep);
  else {
    shape.points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
    if (shape.closed) path.close();
  }
  return (
    <Path
      path={path}
      color={color}
      end={progress ?? 1}
      style={shape.type === 'path' && shape.fill ? 'fill' : 'stroke'}
      strokeWidth={shape.type === 'arc' ? 19 : 1.2}
    />
  );
}
