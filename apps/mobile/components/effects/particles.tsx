import { useMemo } from 'react';
import { Canvas, Atlas, Skia, rect, useRSXformBuffer } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { designTokens } from '@tianji/ui-core/tokens';
export type ParticlePreset = 'sparkle' | 'ink' | 'stardust';
/** Match the Web useParticles(ref, preset) entry point using an 80-sprite UI-thread atlas. */
export function useParticles(ref: SharedValue<number>, preset: ParticlePreset) {
  const image = useMemo(() => {
    const surface = Skia.Surface.MakeOffscreen(16, 16);
    if (!surface) return null;
    const paint = Skia.Paint();
    paint.setColor(
      Skia.Color(
        preset === 'ink'
          ? designTokens.east.ink
          : preset === 'stardust'
            ? designTokens.west.accent
            : designTokens.base.gold,
      ),
    );
    surface.getCanvas().drawCircle(8, 8, 4, paint);
    surface.flush();
    // DESIGN-GAP: CPU-backed sprite snapshots are portable between offscreen and render contexts.
    return surface.makeImageSnapshot().makeNonTextureImage();
  }, [preset]);
  const origins = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        x: Math.cos(i * 2.399),
        y: Math.sin(i * 2.399),
        phase: i * 37,
      })),
    [],
  );
  const transforms = useRSXformBuffer(80, (value, i) => {
    'worklet';
    const origin = origins[i]!;
    const age = ((ref.value + origin.phase) % 900) / 900;
    const spread = 25 + age * 140;
    value.set(1 - age, 0, 170 + origin.x * spread, 220 + origin.y * spread - age * 90);
  });
  return {
    image,
    transforms,
    sprites: useMemo(() => Array.from({ length: 80 }, () => rect(0, 0, 16, 16)), []),
  };
}
/** Eighty particles with the three documented gold/ink/stardust presets. */
export function Particles({
  size,
  clock,
  preset,
}: {
  size: number;
  clock: SharedValue<number>;
  preset: ParticlePreset;
}) {
  const batch = useParticles(clock, preset);
  return (
    <Canvas style={{ width: size, height: size }}>{batch.image && <Atlas {...batch} />}</Canvas>
  );
}
