import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useLowPowerMode } from 'expo-battery';
import { useSharedValue } from 'react-native-reanimated';
/** Stop decorative animation for system accessibility, power saving and background state. */
export function useEffectsMotion() {
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const lowPower = useLowPowerMode();
  const enabled = useSharedValue(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const a = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const b = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => {
      alive = false;
      a.remove();
      b.remove();
    };
  }, []);
  const active = !reduced && !lowPower && foreground;
  useEffect(() => {
    enabled.value = active;
  }, [active, enabled]);
  return { active, enabled, reduced, lowPower };
}
