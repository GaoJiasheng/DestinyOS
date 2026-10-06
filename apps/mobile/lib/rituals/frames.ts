import { useEffect } from 'react';
import { File, Paths } from 'expo-file-system';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { summarizeFrames } from '../diagnostics/frame-metrics';
/** Developer-only display-link cadence during finite ritual animations; never records input or charts. */
export function useRitualFrames(enabled: boolean, system: 'tarot' | 'iching' | 'qimen') {
  const running = useSharedValue(false);
  const intervals = useSharedValue<number[]>([]);
  const previous = useSharedValue(-1);
  useEffect(() => {
    running.value = __DEV__ && enabled;
  }, [enabled, running]);
  function save(samples: number[]) {
    // DESIGN-GAP: Display-link cadence measures scheduling, not GPU completion; physical-device profiling remains M14.
    if (samples.length < 3) return;
    try {
      new File(Paths.document, `M07-${system}-frames.json`).write(
        JSON.stringify(summarizeFrames(samples, 'ui-display')),
      );
    } catch {
      /* diagnostics must never interrupt a ritual */
    }
  }
  useFrameCallback((frame) => {
    if (!running.value) {
      if (intervals.value.length) {
        scheduleOnRN(save, [...intervals.value]);
        intervals.value = [];
      }
      previous.value = -1;
      return;
    }
    if (previous.value >= 0) intervals.value.push(frame.timestamp - previous.value);
    previous.value = frame.timestamp;
  }, __DEV__);
}
