'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei/web/Html';
import { AdditiveBlending, BackSide, Color, Group, ShaderMaterial, Vector3 } from 'three';
import { useTranslations } from 'next-intl';
import { decodeStars, equatorialPoint, type CatalogStar } from '@/lib/star-catalog';
import { DemandCanvas } from './demand-canvas';
import { SceneBoundary, SceneRuntime } from './scene-runtime';
import { planetsAt, zenithAt, type SkyPlace } from './sky-position';
const vertexShader = `attribute float magnitude; attribute vec3 starColor;
varying vec3 vColor; varying float vBrightness; uniform float pixelRatio;
void main() { vColor = starColor; vBrightness = clamp(pow(2.512, -magnitude * .35), .15, 1.0);
vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p;
gl_PointSize = clamp(4.0 - (magnitude + 1.5) * .33, 1.5, 4.0) * pixelRatio; }`;
const fragmentShader = `varying vec3 vColor; varying float vBrightness;
void main() { float r = length(gl_PointCoord - .5) * 2.0; if(r > 1.0) discard;
float alpha = exp(-4.0*r*r) * vBrightness; gl_FragColor = vec4(vColor, alpha); }`;
function Stars({ stars }: { stars: CatalogStar[] }) {
  const { gl } = useThree();
  const attributes = useMemo(() => {
    const positions = new Float32Array(stars.length * 3),
      colors = new Float32Array(stars.length * 3);
    const magnitudes = new Float32Array(stars.length);
    const blue = new Color('#9cbfff'),
      white = new Color('#f7f5ff'),
      yellow = new Color('#ffe1a0'),
      orange = new Color('#ffb56c'),
      color = new Color();
    stars.forEach((star, i) => {
      positions.set(equatorialPoint(star.ra, star.dec), i * 3);
      magnitudes[i] = star.mag;
      if (star.ci < 0) color.copy(white).lerp(blue, Math.min(1, -star.ci / 0.4));
      else if (star.ci < 0.6) color.copy(white).lerp(yellow, star.ci / 0.6);
      else color.copy(yellow).lerp(orange, Math.min(1, (star.ci - 0.6) / 1.4));
      color.toArray(colors, i * 3);
    });
    return { positions, colors, magnitudes };
  }, [stars]);
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.positions, 3]} />
        <bufferAttribute attach="attributes-starColor" args={[attributes.colors, 3]} />
        <bufferAttribute attach="attributes-magnitude" args={[attributes.magnitudes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ pixelRatio: { value: gl.getPixelRatio() } }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
function Galaxy() {
  // DESIGN-GAP: A procedural galactic band avoids third-party image licensing and a 4K texture's GPU memory.
  return (
    <mesh>
      <sphereGeometry args={[110, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        transparent
        depthWrite={false}
        vertexShader={`varying vec3 direction; void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec3 direction; void main(){vec3 n=normalize(vec3(-.868,.456,-.198));float band=exp(-pow(dot(normalize(direction),n)*12.0,2.0));float noise=fract(sin(dot(direction.xy,vec2(12.9898,78.233)))*43758.5453);gl_FragColor=vec4(.26,.28,.42,band*(.2+.15*noise));}`}
      />
    </mesh>
  );
}
function Meteor() {
  const group = useRef<Group>(null),
    material = useRef<ShaderMaterial>(null);
  const timing = useRef({ next: 0, start: -10, x: 0, y: 0 });
  useFrame(({ camera, clock }) => {
    const now = clock.elapsedTime,
      state = timing.current;
    if (!state.next) state.next = now + 8 + Math.random() * 12;
    if (now >= state.next) {
      state.start = now;
      state.next = now + 8 + Math.random() * 12;
      state.x = (Math.random() - 0.5) * 25;
      state.y = Math.random() * 10;
    }
    const progress = (now - state.start) / 1.2;
    if (group.current) {
      group.current.visible = progress >= 0 && progress <= 1;
      group.current.quaternion.copy(camera.quaternion);
      group.current.position
        .set(state.x + progress * 20, state.y - progress * 9, -40)
        .applyQuaternion(camera.quaternion);
    }
    if (material.current)
      material.current.uniforms.fade!.value = Math.max(0, Math.sin(Math.PI * progress));
  });
  return (
    <group ref={group} visible={false}>
      <mesh rotation={[0, 0, -0.42]}>
        <planeGeometry args={[7, 0.07]} />
        <shaderMaterial
          ref={material}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{ fade: { value: 0 } }}
          vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
          fragmentShader={`varying vec2 vUv;uniform float fade;void main(){gl_FragColor=vec4(.95,.88,.7,vUv.x*fade);}`}
        />
      </mesh>
    </group>
  );
}
function Sky({
  stars,
  place,
  labels,
}: {
  stars: CatalogStar[];
  place: SkyPlace;
  labels: Record<string, string>;
}) {
  const { camera } = useThree();
  const group = useRef<Group>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const target = useMemo(() => new Vector3(...zenithAt(now, place)), [now, place]);
  const planets = useMemo(() => planetsAt(now, place), [now, place]);
  useEffect(() => {
    camera.lookAt(target);
  }, [camera, target]);
  useFrame(({ pointer, size }, delta) => {
    if (group.current)
      group.current.rotation.y += (((Math.min(delta, 0.05) * Math.PI) / 180) * 0.25) / 60;
    // DESIGN-GAP: Pointer parallax is desktop-only; mobile gyroscope remains disabled to save power.
    camera.lookAt(target);
    if (size.width >= 768) {
      camera.rotateY((pointer.x * Math.PI) / 60);
      camera.rotateX((-pointer.y * Math.PI) / 60);
    }
  });
  return (
    <>
      <group ref={group}>
        <Stars stars={stars} />
        <Galaxy />
        {planets.map((planet) => (
          <group key={planet.key} position={planet.position}>
            <mesh>
              <sphereGeometry args={[0.24, 8, 8]} />
              <meshBasicMaterial color="#e8d3a3" />
            </mesh>
            <Html center distanceFactor={100}>
              <span className="sky-planet" tabIndex={0} aria-label={labels[planet.key]}>
                <span aria-hidden>✦</span>
                <span className="sky-planet-name">{labels[planet.key]}</span>
              </span>
            </Html>
          </group>
        ))}
      </group>
      <Meteor />
    </>
  );
}
/** Lazy, bounded-DPR BSC5 sky; CSS remains underneath during loading and failures. */
export default function StarfieldCanvas({
  place,
  onFailure,
}: {
  place: SkyPlace;
  onFailure: () => void;
}) {
  const t = useTranslations();
  const labels = Object.fromEntries(
    ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((key) => [
      key,
      t(`charts.planet.${key}`),
    ]),
  );
  const host = useRef<HTMLDivElement>(null);
  const [stars, setStars] = useState<CatalogStar[] | null>(null);
  const fail = useCallback(() => onFailure(), [onFailure]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/stars.bin', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('BSC5 unavailable');
        return r.arrayBuffer();
      })
      .then((buffer) => setStars(decodeStars(buffer)))
      .catch(() => {
        if (!controller.signal.aborted) fail();
      });
    return () => controller.abort();
  }, [fail]);
  return (
    <div className="starfield-canvas" ref={host} data-starfield-canvas>
      {stars && (
        <SceneBoundary onFailure={fail}>
          <DemandCanvas
            onFailure={fail}
            camera={{ position: [0, 0, 0], fov: 85, near: 0.1, far: 120 }}
          >
            <SceneRuntime host={host} onFailure={fail} />
            <Sky stars={stars} place={place} labels={labels} />
          </DemandCanvas>
        </SceneBoundary>
      )}
    </div>
  );
}
