import { createContext, useContext, useEffect, useState, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Text } from 'react-native';

/** Observe live VoiceOver/TalkBack and system motion preferences; default to static until resolved. */
export function useSystemAccessibility() {
  const [reduced, setReduced] = useState(true);
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => undefined);
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (alive) setScreenReader(value);
      })
      .catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      alive = false;
      motion.remove();
      reader.remove();
    };
  }, []);
  return { reduced, screenReader };
}

// DESIGN-GAP: Native sheets and pages focus a heading after presentation; system readers own spoken navigation, with no custom gesture replacement.
/** Move assistive focus to a newly opened sheet heading after its native presentation. */
export function focusHeading(ref: RefObject<Text | null>) {
  void AccessibilityInfo.isScreenReaderEnabled()
    .then((enabled) => {
      const node = ref.current && findNodeHandle(ref.current);
      if (enabled && node) AccessibilityInfo.setAccessibilityFocus(node);
    })
    .catch(() => undefined);
}

/** Root supplies the encrypted in-app motion preference without coupling reusable sheets to profile data. */
export const MotionPreferenceContext = createContext(false);
/** Combine the live operating-system preference with the app preference. */
export function useReducedMotion() {
  const { reduced } = useSystemAccessibility();
  const appReduced = useContext(MotionPreferenceContext);
  return reduced || appReduced;
}
