'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createRoot, extend, events, type ReconcilerRoot } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { SceneBoundary } from './scene-runtime';
// DESIGN-GAP: R3F's documented granular createRoot/extend API avoids pulling every Three constructor into the 220KB lazy budget.
extend({
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
});
/** Resize-aware, demand-only R3F canvas with a granular Three catalogue and bounded DPR. */
export function DemandCanvas({
  children,
  camera,
  onFailure,
}: {
  children: ReactNode;
  camera: { position: [number, number, number]; fov: number; near?: number; far?: number };
  onFailure: () => void;
}) {
  const element = useRef<HTMLCanvasElement>(null);
  const root = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
  const configured = useRef(false);
  const initialCamera = useRef(camera);
  const content = useRef(children);
  content.current = children;
  useEffect(() => {
    const canvas = element.current;
    if (!canvas) return;
    let live = true;
    const renderer = createRoot(canvas);
    root.current = renderer;
    let queue: Promise<void> = Promise.resolve();
    const configure = () => {
      const { width, height, top, left } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      queue = queue
        .then(async () => {
          if (!live) return;
          await renderer.configure({
            size: { width, height, top, left },
            events,
            camera: initialCamera.current,
            dpr: [1, 1.5],
            frameloop: 'demand',
            gl: { powerPreference: 'low-power', antialias: false, alpha: true },
            onCreated: (state) => state.events.connect?.(canvas.parentElement ?? canvas),
          });
          if (live) {
            configured.current = true;
            renderer.render(<SceneBoundary onFailure={onFailure}>{content.current}</SceneBoundary>);
          }
        })
        .catch(() => {
          if (live) onFailure();
        });
    };
    const observer = new ResizeObserver(configure);
    observer.observe(canvas);
    configure();
    return () => {
      live = false;
      observer.disconnect();
      root.current = null;
      configured.current = false;
      renderer.unmount();
    };
  }, [onFailure]);
  useEffect(() => {
    if (configured.current)
      root.current?.render(<SceneBoundary onFailure={onFailure}>{children}</SceneBoundary>);
  }, [children, onFailure]);
  return (
    <div className="demand-surface">
      <canvas ref={element} className="demand-canvas" />
    </div>
  );
}
