import { useMemo } from 'react';
import { Canvas, Group, Circle, Path, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { wheelPoint } from '@tianji/ui-core/celestial';
import type { AstroChart } from '@tianji/shared';
import { designTokens } from '@tianji/ui-core/tokens';
const gold = designTokens.base.gold;
/** Repeating wheel entrance: 800ms ring, staggered actual natal planets, then stroke-trimmed aspects. */
export function Wheel({
  size,
  clock,
  chart,
  animated = true,
}: {
  size: number;
  clock: SharedValue<number>;
  chart: AstroChart;
  animated?: boolean;
}) {
  const center = size / 2,
    radius = size * 0.4;
  const lines = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 12; i++) {
      const a = wheelPoint(i * 30, radius, center);
      p.moveTo(center, center);
      p.lineTo(a.x, a.y);
    }
    return p;
  }, [center, radius]);
  const aspects = useMemo(() => {
    const p = Skia.Path.Make();
    chart.aspects.forEach((aspect) => {
      const a = chart.bodies.find((body) => body.key === aspect.a),
        b = chart.bodies.find((body) => body.key === aspect.b);
      if (!a || !b) return;
      const x = wheelPoint(a.lon, radius * 0.72, center),
        y = wheelPoint(b.lon, radius * 0.72, center);
      p.moveTo(x.x, x.y);
      p.lineTo(y.x, y.y);
    });
    return p;
  }, [chart, center, radius]);
  const transform = useDerivedValue(() => [
    { rotate: animated ? Math.max(0, 1 - (clock.value % 4800) / 800) * Math.PI * 0.5 : 0 },
  ]);
  const end = useDerivedValue(() =>
    animated ? Math.max(0, Math.min(1, ((clock.value % 4800) - 1700) / 800)) : 1,
  );
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={transform} origin={vec(center, center)}>
        <Circle cx={center} cy={center} r={radius} color={gold} style="stroke" strokeWidth={1.5} />
        <Circle
          cx={center}
          cy={center}
          r={radius * 0.85}
          color={gold}
          style="stroke"
          strokeWidth={1}
        />
        <Path path={lines} color={designTokens.base['line-2']} style="stroke" strokeWidth={1} />
      </Group>
      <Path
        path={aspects}
        color={designTokens.base.info}
        style="stroke"
        strokeWidth={1}
        end={end}
      />
      {chart.bodies.map((body, index) => (
        <WheelPlanet
          key={body.key}
          lon={body.lon}
          index={index}
          clock={clock}
          center={center}
          radius={radius}
          animated={animated}
        />
      ))}
    </Canvas>
  );
}
function WheelPlanet({
  lon,
  index,
  clock,
  center,
  radius,
  animated,
}: {
  lon: number;
  index: number;
  clock: SharedValue<number>;
  center: number;
  radius: number;
  animated: boolean;
}) {
  const point = useDerivedValue(() => {
    const t = animated
      ? Math.min(1, Math.max(0, ((clock.value % 4800) - 800 - index * 40) / 400))
      : 1;
    const angle = (-lon * Math.PI) / 180,
      r = radius * (0.72 + (1 - t) * 0.7);
    return { x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r };
  });
  const x = useDerivedValue(() => point.value.x),
    y = useDerivedValue(() => point.value.y);
  return <Circle cx={x} cy={y} r={4} color={gold} />;
}
