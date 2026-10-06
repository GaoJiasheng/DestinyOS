import { File, Paths } from 'expo-file-system';
import { isDevice } from 'expo-device';
import { View, PanResponder, Platform } from 'react-native';
import { Component, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Group, WebGLRenderTarget } from 'three';
import type { AstroChart } from '@tianji/shared';
import { celestialScene, equatorialPoint } from '@tianji/ui-core/celestial';
import { designTokens } from '@tianji/ui-core/tokens';
import type { FrameMeasurement } from '../../lib/diagnostics/frames';
import { summarizeFrames } from '../../lib/diagnostics/frames';
class Boundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
/** Same shared celestial geometry as Web; failures and missing GL contexts select the Skia wheel. */
export function Sphere({
  chart,
  size,
  active,
  onFailure,
  onMeasured,
}: {
  chart: AstroChart;
  size: number;
  active: boolean;
  onFailure: () => void;
  onMeasured: (measurement: FrameMeasurement) => void;
}) {
  const ready = useRef(false);
  const rotation = useRef({ x: 0, y: 0 });
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onPanResponderMove: (_, gesture) => {
          rotation.current = { x: gesture.dy * 0.004, y: gesture.dx * 0.004 };
        },
      }),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready.current) onFailure();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onFailure]);
  return (
    <View {...drag.panHandlers} style={{ width: size, height: size }}>
      <Boundary onFailure={onFailure}>
        <Canvas
          style={{ width: size, height: size }}
          camera={{ position: [0, 5, 3], fov: 45 }}
          frameloop={active ? 'always' : 'demand'}
          gl={{ antialias: false }}
          onCreated={(state) => {
            // DESIGN-GAP: A live GL context can still draw an empty frame on iOS; verify framebuffer output before accepting render-loop FPS.
            const context = state.gl.getContext() as WebGLRenderingContext & {
              endFrameEXP(): void;
            };
            const present = context.endFrameEXP.bind(context);
            let frames = 0;
            context.endFrameEXP = () => {
              if (++frames === 5) {
                const target = new WebGLRenderTarget(32, 32, { samples: 0 });
                const previous = state.gl.getRenderTarget();
                try {
                  // DESIGN-GAP: Read a single-sample target; iOS initially allocates a multisample default buffer even when r3f later disables antialiasing.
                  const renderError = context.getError();
                  state.gl.setRenderTarget(target);
                  state.gl.render(state.scene, state.camera);
                  const pixels = new Uint8Array(32 * 32 * 4);
                  state.gl.readRenderTargetPixels(target, 0, 0, 32, 32, pixels);
                  let visible = 0;
                  for (let i = 0; i < pixels.length; i += 4)
                    if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 50) visible++;
                  const probeError = context.getError();
                  // DESIGN-GAP: This iOS simulator presents a blank expo-gl layer despite a live render loop; use the documented 2D fallback. Physical iOS and Android retain GL.
                  const simulatorFallback = Platform.OS === 'ios' && !isDevice;
                  new File(Paths.document, 'M02-gl.json').write(
                    JSON.stringify({
                      visible,
                      renderError,
                      probeError,
                      simulatorFallback,
                      isDevice,
                      width: context.drawingBufferWidth,
                      height: context.drawingBufferHeight,
                      calls: state.gl.info.render.calls,
                    }),
                  );
                  if (
                    simulatorFallback ||
                    visible === 0 ||
                    renderError !== context.NO_ERROR ||
                    probeError !== context.NO_ERROR
                  )
                    onFailure();
                  else ready.current = true;
                } catch (error) {
                  new File(Paths.document, 'M02-gl.json').write(
                    JSON.stringify({ error: String(error) }),
                  );
                  onFailure();
                } finally {
                  state.gl.setRenderTarget(previous);
                  target.dispose();
                }
              }
              present();
            };
          }}
        >
          <Celestial chart={chart} onMeasured={onMeasured} rotation={rotation} />
        </Canvas>
      </Boundary>
    </View>
  );
}
function Celestial({
  chart,
  onMeasured,
  rotation,
}: {
  chart: AstroChart;
  onMeasured: (measurement: FrameMeasurement) => void;
  rotation: { current: { x: number; y: number } };
}) {
  const group = useRef<Group>(null);
  const sampling = useRef({ start: -1, previous: 0, intervals: [] as number[], done: false });
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = rotation.current.y + clock.elapsedTime * 0.15;
      group.current.rotation.x = rotation.current.x;
    }
    const s = sampling.current,
      now = clock.elapsedTime * 1000;
    if (s.start < 0) s.start = now;
    if (now - s.start < 2000) {
      s.previous = now;
      return;
    }
    if (s.done) return;
    s.intervals.push(now - s.previous);
    s.previous = now;
    if (now - s.start >= 12000) {
      s.done = true;
      onMeasured(summarizeFrames(s.intervals, 'r3f-render'));
    }
  });
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={celestialScene.sphere} />
        <meshBasicMaterial
          color={designTokens.base['text-2']}
          wireframe
          transparent
          opacity={0.16}
        />
      </mesh>
      <group rotation={[(-chart.obliquity * Math.PI) / 180, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={celestialScene.ecliptic} />
          <meshBasicMaterial color={designTokens.base.gold} />
        </mesh>
        {chart.bodies.map((body, i) => (
          <mesh
            key={body.key}
            position={equatorialPoint(body.lon, body.lat, celestialScene.planetRadius(i))}
          >
            <sphereGeometry args={[0.055, 12, 8]} />
            <meshBasicMaterial color={designTokens.base.gold} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
