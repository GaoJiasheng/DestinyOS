'use client';
import { useRef } from 'react';
import { DemandCanvas } from './demand-canvas';
import { Html } from '@react-three/drei/web/Html';
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import { useTranslations } from 'next-intl';
import type { AstroChart } from '@tianji/shared';
import { equatorialPoint } from '@/lib/star-catalog';
import { SceneBoundary, SceneRuntime } from './scene-runtime';
import { bodyFromEvidence, SIGN_GLYPHS } from '../charts/astro-geometry';
/** Draggable celestial sphere using the report's actual ecliptic planet coordinates. */
export default function NatalWheel3D({
  chart,
  highlight,
  onSelect,
  onFailure,
}: {
  chart: AstroChart;
  highlight?: string;
  onSelect?: (section: string, path?: string) => void;
  onFailure: () => void;
}) {
  const t = useTranslations();
  const host = useRef<HTMLDivElement>(null);
  const active = bodyFromEvidence(chart.bodies, highlight);
  return (
    <div
      className="natal-wheel-3d"
      ref={host}
      role="group"
      aria-label={t('charts.natal.threeLabel')}
      data-natal-wheel-3d
    >
      <p className="type-small muted">{t('charts.natal.drag')}</p>
      <SceneBoundary onFailure={onFailure}>
        {/* DESIGN-GAP: An elevated initial view separates the ecliptic from the equator; names appear on hover/focus/selection to avoid crowding. */}
        <DemandCanvas onFailure={onFailure} camera={{ position: [0, 5, 3], fov: 45 }}>
          <SceneRuntime host={host} onFailure={onFailure} animate={false} />
          <OrbitControls enablePan={false} enableDamping minDistance={3.5} maxDistance={8} />
          <mesh>
            <sphereGeometry args={[1.55, 24, 12]} />
            <meshBasicMaterial color="#b8b5ac" wireframe transparent opacity={0.16} />
          </mesh>
          <group rotation={[(-chart.obliquity * Math.PI) / 180, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.6, 0.03, 4, 96]} />
              <meshBasicMaterial color="#d4af6a" />
            </mesh>
            {Array.from({ length: 12 }, (_, i) => (
              <group key={i} position={equatorialPoint(i * 30, 0, 1.78)}>
                <Html center>
                  <span className="sky-zodiac">
                    <span
                      title={t(
                        `charts.sign.${['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'][i]}`,
                      )}
                    >
                      {SIGN_GLYPHS[i]}︎
                    </span>
                  </span>
                </Html>
              </group>
            ))}
            {chart.bodies.map((body, i) => (
              <group
                key={body.key}
                position={equatorialPoint(body.lon, body.lat, 1.4 + (i % 3) * 0.08)}
              >
                <mesh>
                  <sphereGeometry args={[active === body.key ? 0.09 : 0.055, 12, 8]} />
                  <meshBasicMaterial color={active === body.key ? '#e8d3a3' : '#d4af6a'} />
                </mesh>
                <Html center>
                  <button
                    className="sky-body"
                    type="button"
                    aria-label={t(`charts.planet.${body.key}`)}
                    aria-pressed={active === body.key}
                    onClick={() =>
                      onSelect?.(
                        body.key === 'sun' || body.key === 'moon' ? 'big_three' : 'planets',
                        `bodies.${i}`,
                      )
                    }
                  >
                    <span className="sky-body-dot" aria-hidden>
                      ●
                    </span>
                    <span className="sky-body-name">{t(`charts.planet.${body.key}`)}</span>
                  </button>
                </Html>
              </group>
            ))}
          </group>
        </DemandCanvas>
      </SceneBoundary>
    </div>
  );
}
