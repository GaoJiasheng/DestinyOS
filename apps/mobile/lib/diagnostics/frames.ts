import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useEffect } from 'react';
import type { FrameMeasurement } from './frame-metrics';
export * from './frame-metrics';
// DESIGN-GAP: Sample each active scene for 10s after a 2s warmup; frame callbacks measure scheduling cadence, not GPU completion.
/** UI display-link samples: 2s warmup, 10s window, no per-frame JS bridging or React commits. */
export function useFrameProbe(
  enabled: SharedValue<boolean>,
  onMeasured: (value: FrameMeasurement) => void,
  resetKey = false,
) {
  const clock = useSharedValue(900);
  const sampling = useSharedValue({
    start: -1,
    previous: 0,
    intervals: [] as number[],
    done: false,
  });
  // DESIGN-GAP: Restart the complete window after a GL-to-Skia transition; never attribute mixed scene samples to the fallback.
  useEffect(() => {
    sampling.value = { start: -1, previous: 0, intervals: [], done: false };
  }, [resetKey, sampling]);
  useFrameCallback((info) => {
    const state = sampling.value;
    if (!enabled.value) {
      clock.value = 900;
      state.start = -1;
      state.intervals = [];
      state.done = false;
      return;
    }
    if (state.start < 0) state.start = info.timestamp;
    clock.value = info.timestamp - state.start;
    if (clock.value < 2000) {
      state.previous = info.timestamp;
      return;
    }
    if (state.done) return;
    state.intervals.push(info.timestamp - state.previous);
    state.previous = info.timestamp;
    if (clock.value >= 12000) {
      state.done = true;
      scheduleOnRN(onMeasured, {
        fps: (state.intervals.length * 1000) / state.intervals.reduce((sum, n) => sum + n, 0),
        p95Ms:
          [...state.intervals].sort((a, b) => a - b)[Math.floor(state.intervals.length * 0.95)] ??
          0,
        frames: state.intervals.length,
        durationMs: state.intervals.reduce((sum, n) => sum + n, 0),
        source: 'ui-display',
        longFrames: state.intervals.filter((ms) => ms > 25).length,
        maxMs: Math.max(0, ...state.intervals),
      });
    }
  });
  return clock;
}
