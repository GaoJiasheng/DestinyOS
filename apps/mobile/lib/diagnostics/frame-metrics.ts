export const effectNames = ['starfield', 'sphere', 'particles', 'tarot', 'coins', 'wheel'] as const;
export type EffectName = (typeof effectNames)[number];
export const targets: Record<EffectName, number> = {
  starfield: 55,
  sphere: 45,
  particles: 60,
  tarot: 60,
  coins: 60,
  wheel: 60,
};
export type FrameMeasurement = {
  fps: number;
  p95Ms: number;
  frames: number;
  durationMs: number;
  source: 'ui-display' | 'r3f-render';
  longFrames?: number;
  maxMs?: number;
};
/** Reject dropped-frame cadence; epsilon only accommodates display timestamp floating point error. */
export function meetsFrameBudget(fps: number, target: number): boolean {
  return Number.isFinite(fps) && fps + 1e-6 >= target;
}
/** Summarize actual callback intervals including stalls, retaining unrounded results. */
export function summarizeFrames(
  intervals: number[],
  source: FrameMeasurement['source'],
): FrameMeasurement {
  const durationMs = intervals.reduce((sum, value) => sum + value, 0);
  const sorted = [...intervals].sort((a, b) => a - b);
  return {
    fps: (intervals.length * 1000) / durationMs,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    frames: intervals.length,
    durationMs,
    source,
  };
}
/** Count missed 60Hz display deadlines in an audit window, retaining the worst stall in milliseconds. */
export function frameStalls(intervals: readonly number[]) {
  return { longFrames: intervals.filter((ms) => ms > 25).length, maxMs: Math.max(0, ...intervals) };
}
