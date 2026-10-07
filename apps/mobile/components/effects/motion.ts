import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useSystemAccessibility } from '../../lib/accessibility';
import { useLowPowerMode } from 'expo-battery';
import { useSharedValue } from 'react-native-reanimated';
/** Stop decorative animation for system accessibility, power saving and background state. */
export function useEffectsMotion() {
  const { reduced, screenReader } = useSystemAccessibility();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const lowPower = useLowPowerMode();
  const enabled = useSharedValue(false);
  useEffect(() => {
    const b = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => {
      b.remove();
    };
  }, []);
  const active = !reduced && !screenReader && !lowPower && foreground;
  useEffect(() => {
    enabled.value = active;
  }, [active, enabled]);
  return { active, enabled, reduced, lowPower };
}
