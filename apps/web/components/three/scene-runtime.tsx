'use client';
import { Component, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { FrameMonitor } from '@/lib/three-policy';
/** Degrade when a renderer fails instead of taking down the page. */
export class SceneBoundary extends Component<
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
/** Drive demand frames only while the scene intersects the viewport and the document is visible. */
export function SceneRuntime({
  host,
  onFailure,
  animate = true,
}: {
  host: RefObject<HTMLDivElement | null>;
  onFailure: () => void;
  animate?: boolean;
}) {
  const { invalidate, gl } = useThree();
  const active = useRef(false);
  const monitor = useRef(new FrameMonitor());
  useEffect(() => {
    let inView = false;
    let frame = 0;
    const tick = () => {
      if (active.current) {
        invalidate();
        frame = requestAnimationFrame(tick);
      }
    };
    const update = () => {
      cancelAnimationFrame(frame);
      active.current = inView && !document.hidden;
      monitor.current.reset();
      if (active.current) {
        invalidate();
        if (animate) frame = requestAnimationFrame(tick);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = !!entry?.isIntersecting;
      update();
    });
    if (host.current) observer.observe(host.current);
    document.addEventListener('visibilitychange', update);
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      active.current = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      gl.domElement.removeEventListener('webglcontextlost', lost);
    };
  }, [animate, gl, host, invalidate, onFailure]);
  useFrame(() => {
    if (active.current && monitor.current.sample(performance.now(), !animate)) onFailure();
  });
  return null;
}
