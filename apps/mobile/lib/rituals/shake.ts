import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { Accelerometer } from 'expo-sensors';
import { createShakeGate } from './model';
/** Subscribe only on the focused, foreground six-line ritual; buttons work without sensors. */
export function useShake(enabled: boolean, onShake: () => void) {
  const focused = useIsFocused();
  const callback = useRef(onShake);
  callback.current = onShake;
  useEffect(() => {
    if (!enabled || !focused) return;
    let live = true;
    let subscription: ReturnType<typeof Accelerometer.addListener> | undefined;
    const gate = createShakeGate();
    function stop() {
      subscription?.remove();
      subscription = undefined;
    }
    async function start() {
      if (!live || AppState.currentState !== 'active') return;
      if (!(await Accelerometer.isAvailableAsync()) || !live || AppState.currentState !== 'active')
        return;
      stop();
      Accelerometer.setUpdateInterval(50);
      subscription = Accelerometer.addListener((sample) => {
        if (AppState.currentState === 'active' && gate(sample, Date.now())) callback.current();
      });
    }
    void start().catch(() => undefined);
    const state = AppState.addEventListener('change', (value) => {
      stop();
      if (value === 'active') void start().catch(() => undefined);
    });
    return () => {
      live = false;
      stop();
      state.remove();
    };
  }, [enabled, focused]);
}
