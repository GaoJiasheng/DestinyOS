/** Small capability gate kept outside the lazy Three.js chunks. */
export function canUseThree(reducedMotion = false): boolean {
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (
    reducedMotion ||
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (device.deviceMemory !== undefined && device.deviceMemory < 4) ||
    device.connection?.saveData
  )
    return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
/** Report a degradation once per mounted scene, without user or location data. */
export function reportThreeFallback(scene: 'home' | 'natal', reason: string) {
  // DESIGN-GAP: T-61 event persistence is pending; emit the named DOM event for its future collector.
  window.dispatchEvent(new CustomEvent('tianji:three-fallback', { detail: { scene, reason } }));
}
/** Track rendered frames in uninterrupted 60-frame windows (hidden time is excluded). */
export class FrameMonitor {
  private started = 0;
  private count = 0;
  private last = 0;
  reset() {
    this.started = 0;
    this.count = 0;
  }
  sample(now: number, idleAllowed = false): boolean {
    if (idleAllowed && this.count && now - this.last > 250) this.reset();
    this.last = now;
    if (!this.count) this.started = now;
    this.count += 1;
    if (this.count < 60) return false;
    const fps = 59_000 / Math.max(1, now - this.started);
    this.reset();
    return fps < 30;
  }
}
