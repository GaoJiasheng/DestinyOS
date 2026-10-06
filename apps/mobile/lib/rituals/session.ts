import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useIsFocused, usePreventRemove } from 'expo-router/react-navigation';
import * as Crypto from 'expo-crypto';
import { useCopy } from '../copy';
import { useProfiles } from '../profiles';
import { useEffectsMotion } from '../../components/effects/motion';
import { createNativeReading } from '../reports/readings';
import { useRitualFeedback } from './feedback';
import type { RitualInput } from './model';
import { useRitualFrames } from './frames';
/** Cancel all delayed effects on blur/background/unmount; protect unfinished private rituals on exit. */
export function useRitualSession(system: 'tarot' | 'iching' | 'qimen') {
  const t = useCopy(),
    router = useRouter(),
    navigation = useNavigation(),
    focused = useIsFocused();
  const { settings, updateSettings } = useProfiles();
  const motion = useEffectsMotion();
  const { feedback: emit, stop } = useRitualFeedback();
  const [dirtyState, setDirtyState] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [seed] = useState(() => Crypto.randomUUID());
  const [id] = useState(() => Crypto.randomUUID());
  const leaving = useRef(false),
    live = useRef(true),
    epoch = useRef(0);
  const pending = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const lock = useRef(false);
  const active = useRef(focused && AppState.currentState === 'active');
  active.current = focused && AppState.currentState === 'active';
  const cancel = useCallback(() => {
    epoch.current++;
    pending.current.forEach((resolve, timer) => {
      clearTimeout(timer);
      resolve();
    });
    pending.current.clear();
    stop();
  }, [stop]);
  useEffect(() => {
    live.current = true;
    const state = AppState.addEventListener('change', (value) => {
      active.current = focused && value === 'active';
      if (!active.current) cancel();
    });
    return () => {
      live.current = false;
      state.remove();
      cancel();
    };
  }, [cancel, focused]);
  useEffect(() => {
    if (!focused) cancel();
  }, [focused, cancel]);
  usePreventRemove(dirtyState, ({ data }) => {
    if (leaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(t('divination.exitTitle'), t('divination.exitBody'), [
      { text: t('divination.stay'), style: 'cancel' },
      {
        text: t('divination.leave'),
        style: 'destructive',
        onPress: () => {
          leaving.current = true;
          cancel();
          navigation.dispatch(data.action);
        },
      },
    ]);
  });
  const animate = motion.active && !settings.reducedMotion;
  useRitualFrames(animating && animate && focused, system);
  async function sequence(steps: { delay: number; action: () => void }[]) {
    if (lock.current || !active.current) return false;
    setDirtyState(true);
    lock.current = true;
    setBusy(true);
    setAnimating(true);
    const ticket = epoch.current;
    try {
      for (const step of steps) {
        if (step.delay > 0)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(
              () => {
                pending.current.delete(timer);
                resolve();
              },
              animate ? step.delay : Math.min(step.delay, 150),
            );
            pending.current.set(timer, resolve);
          });
        if (!live.current || !active.current || epoch.current !== ticket) return false;
        step.action();
      }
      return true;
    } finally {
      lock.current = false;
      if (live.current) {
        setBusy(false);
        setAnimating(false);
      }
    }
  }
  async function save(now: string, input: RitualInput, castSeed = seed) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const saved = await createNativeReading(system, null, undefined, now, castSeed, input, id);
      if (!live.current || !active.current) return;
      leaving.current = true;
      router.replace({ pathname: '/[system]/r/[id]', params: { system, id: saved.id } });
    } catch {
      if (live.current) setError(true);
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  return {
    seed,
    busy,
    error,
    animate,
    settings,
    updateSettings,
    sequence,
    save,
    feedback: emit,
    markDirty: () => {
      setDirtyState(true);
    },
    exit: () => router.back(),
  };
}
