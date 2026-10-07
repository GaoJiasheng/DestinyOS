import interFont from '../../assets/fonts/inter.ttf';
import notoFont from '../../assets/fonts/noto.ttf';
import { usePreferences } from '../../lib/preferences';
import starAsset from '../../../web/public/stars.bin';
import { useEffect, useMemo, useState } from 'react';
import {
  Canvas,
  Atlas,
  Circle,
  Group,
  Path,
  Skia,
  TileMode,
  rect,
  LinearGradient,
  vec,
  Text as SkiaText,
  useFont,
} from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { Gyroscope } from 'expo-sensors';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { decodeStars, starAppearance, type CatalogStar } from '@tianji/ui-core/celestial';
import { designTokens } from '@tianji/ui-core/tokens';
import { zenithAt, planetsAt } from '@tianji/ui-core/sky-position';
import { equatorialPoint } from '@tianji/ui-core/celestial';
const gold = designTokens.base.gold;
/** Offline BSC5 atlas: one GPU batch for all 9,096 stars, static projection and bounded sensor parallax. */
export function Starfield({
  size,
  clock,
  active,
  labels,
  now,
  place,
  parallax = true,
  diagnostics = true,
}: {
  size: number;
  clock: SharedValue<number>;
  active: boolean;
  labels: Record<string, string>;
  now?: Date;
  place?: { lat: number; lng: number };
  parallax?: boolean;
  diagnostics?: boolean;
}) {
  const [stars, setStars] = useState<CatalogStar[]>([]);
  const tilt = useSharedValue({ x: 0, y: 0 });
  const locale = usePreferences((s) => s.locale);
  const font = useFont(locale === 'en' ? interFont : notoFont, 12);
  // DESIGN-GAP: The developer fixture uses Beijing without requesting sensitive location permission.
  const sky = useMemo(() => {
    const instant = now ?? new Date('2026-10-04T04:00:00Z');
    const location = place ?? { lat: 39.9, lng: 116.4 };
    return { zenith: zenithAt(instant, location), planets: planetsAt(instant, location) };
  }, [now, place]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const asset = Asset.fromModule(starAsset);
      await asset.downloadAsync();
      const bytes = await new File(asset.localUri ?? asset.uri).bytes();
      const catalog = decodeStars(bytes.buffer as ArrayBuffer);
      if (diagnostics)
        new File(Paths.document, 'M02-catalog.json').write(
          JSON.stringify({ records: catalog.length, bytes: bytes.byteLength }),
        );
      if (alive) setStars(catalog);
    })().catch((error) => {
      if (diagnostics)
        new File(Paths.document, 'M02-catalog.json').write(
          JSON.stringify({ error: String(error) }),
        );
    });
    return () => {
      alive = false;
    };
  }, [diagnostics]);
  useEffect(() => {
    if (!active || !parallax) return;
    let subscription: ReturnType<typeof Gyroscope.addListener> | undefined;
    let alive = true;
    void Gyroscope.isAvailableAsync().then((available) => {
      if (!alive || !available) return;
      Gyroscope.setUpdateInterval(33);
      subscription = Gyroscope.addListener(({ x, y }) => {
        tilt.value = {
          x: Math.max(-3, Math.min(3, tilt.value.x * 0.98 + y * 1.89)),
          y: Math.max(-3, Math.min(3, tilt.value.y * 0.98 + x * 1.89)),
        };
      });
    });
    return () => {
      alive = false;
      subscription?.remove();
      tilt.value = { x: 0, y: 0 };
    };
  }, [active, parallax, tilt]);
  const project = useMemo(() => {
    const forward = sky.zenith,
      right: [number, number, number] = [-forward[2], 0, forward[0]],
      norm = Math.hypot(...right);
    right.forEach((value, i) => (right[i] = value / norm));
    const up = [
      forward[1] * right[2],
      forward[2] * right[0] - forward[0] * right[2],
      -forward[1] * right[0],
    ];
    return (p: [number, number, number]) => {
      const depth = p.reduce((sum, v, i) => sum + v * forward[i]!, 0);
      if (depth <= 0.05) return { x: -1000, y: -1000 };
      return {
        x: size / 2 + ((p.reduce((sum, v, i) => sum + v * right[i]!, 0) / depth) * size) / 2,
        y: size / 2 - ((p.reduce((sum, v, i) => sum + v * up[i]!, 0) / depth) * size) / 2,
      };
    };
  }, [size, sky]);
  const batch = useMemo(() => {
    const surface = Skia.Surface.MakeOffscreen(16, 16);
    if (!surface) return null;
    const paint = Skia.Paint();
    const stops = [0, 0.25, 0.5, 0.75, 1];
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        vec(8, 8),
        6,
        stops.map((r) => Skia.Color(`rgba(255,255,255,${Math.exp(-4 * r * r)})`)),
        stops,
        TileMode.Clamp,
      ),
    );
    surface.getCanvas().drawCircle(8, 8, 6, paint);
    surface.flush();
    return {
      // DESIGN-GAP: Upload a CPU-backed sprite to the render thread; offscreen GPU textures are context-specific.
      image: surface.makeImageSnapshot().makeNonTextureImage(),
      sprites: stars.map(() => rect(0, 0, 16, 16)),
      colors: stars.map((star) => new Float32Array(starAppearance(star))),
      transforms: stars.map((star) => {
        const point = project(equatorialPoint(star.ra, star.dec, 1));
        const scale = Math.max(1.5, Math.min(4, 4 - (star.mag + 1.5) * 0.33)) / 6;
        return Skia.RSXform(scale, 0, point.x - scale * 8, point.y - scale * 8);
      }),
    };
  }, [project, stars]);
  const transform = useDerivedValue(() => [
    { translateX: active ? (tilt.value.x * size) / 85 : 0 },
    { translateY: active ? (tilt.value.y * size) / 85 : 0 },
    { rotate: active ? (((clock.value * Math.PI) / 180) * 0.25) / 60000 : 0 },
  ]);
  const meteorPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const cycle = Math.floor(clock.value / 12000),
      progress = (clock.value % 12000) / 1200;
    if (progress <= 1 && active) {
      const x = size * (0.15 + (cycle % 3) * 0.1 + progress * 0.65),
        y = size * (0.1 + progress * 0.4);
      p.moveTo(x - 45, y - 24);
      p.lineTo(x, y);
    }
    return p;
  });
  return (
    <Canvas
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Group transform={transform} origin={vec(size / 2, size / 2)}>
        {batch && (
          <Atlas
            image={batch.image}
            sprites={batch.sprites}
            transforms={batch.transforms}
            colors={batch.colors}
            colorBlendMode="modulate"
          />
        )}
        {sky.planets.map((planet) => {
          const point = project(planet.position);
          if (!font || point.x < 0 || point.x > size || point.y < 0 || point.y > size) return null;
          const label = labels[planet.key] ?? '';
          const labelWidth = font.measureText(label).width;
          return (
            <Group key={planet.key}>
              <Circle cx={point.x} cy={point.y} r={2.5} color={gold} />
              <SkiaText
                x={Math.max(4, Math.min(size - labelWidth - 4, point.x + 6))}
                y={Math.max(16, Math.min(size - 4, point.y))}
                text={label}
                font={font}
                color={gold}
              />
            </Group>
          );
        })}
      </Group>
      <Path path={meteorPath} style="stroke" strokeWidth={2}>
        <LinearGradient start={vec(0, 0)} end={vec(size, size)} colors={['transparent', gold]} />
      </Path>
    </Canvas>
  );
}
