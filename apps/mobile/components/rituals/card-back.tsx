import { memo } from 'react';
import {
  Canvas,
  Circle,
  Path,
  RoundedRect,
  LinearGradient,
  vec,
  Skia,
} from '@shopify/react-native-skia';
import { designTokens } from '@tianji/ui-core/tokens';
const gold = designTokens.base.gold;
/** GPU card back: dark purple, eight-point star and concentric moon-phase ornaments. */
export const CardBack = memo(function CardBack({
  width = 72,
  height = 126,
}: {
  width?: number;
  height?: number;
}) {
  const star = Skia.PathBuilder.Make();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const r = (i % 2 ? 0.13 : 0.32) * width;
    const x = width / 2 + Math.cos(a) * r,
      y = height / 2 + Math.sin(a) * r;
    if (!i) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.close();
  return (
    <Canvas style={{ width, height }}>
      <RoundedRect x={0} y={0} width={width} height={height} r={6}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={[
            designTokens.base['bg-1'],
            `${designTokens.west.accent}66`,
            designTokens.base['bg-0'],
          ]}
        />
      </RoundedRect>
      <RoundedRect
        x={4}
        y={4}
        width={width - 8}
        height={height - 8}
        r={4}
        style="stroke"
        strokeWidth={1}
        color={gold}
      />
      <Circle
        cx={width / 2}
        cy={height / 2}
        r={width * 0.37}
        color={gold}
        style="stroke"
        strokeWidth={0.7}
      />
      <Path path={star.build()} color={gold} style="stroke" strokeWidth={1} />
      {Array.from({ length: 8 }, (_, i) => (
        <Circle
          key={i}
          cx={width / 2 + Math.cos((i * Math.PI) / 4) * width * 0.34}
          cy={height / 2 + Math.sin((i * Math.PI) / 4) * width * 0.34}
          r={2}
          color={gold}
        />
      ))}
    </Canvas>
  );
});
