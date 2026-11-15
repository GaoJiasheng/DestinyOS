'use client';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { BirthInput } from '@tianji/shared';
import { initialBirth } from '@/lib/birth-form-initial';
import { readAnonymous } from '@/lib/anonymous-storage';
import type { BirthTarget } from './birth-form-parts';
type Saved = { birth: BirthInput; displayName: string };
/** Device-profile prefill and the guest's "who is this for" choice.
 * Without a device profile the form behaves as before; with one, charting defaults to someone else. */
export function useBirthTarget({
  signedIn,
  hasInitial,
  embedded,
  profileMode,
  prefillProfile,
  dirty,
  setBirth,
  setName,
  setPrecise,
  setError,
}: {
  signedIn: boolean;
  hasInitial: boolean;
  embedded: boolean;
  profileMode: boolean;
  prefillProfile: boolean;
  dirty: MutableRefObject<boolean>;
  setBirth: (birth: BirthInput) => void;
  setName: (name: string) => void;
  setPrecise: (precise: boolean) => void;
  setError: (key: string) => void;
}) {
  const [target, setTarget] = useState<BirthTarget | null>(profileMode ? 'self' : null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const prefilled = useRef(false);
  const fill = useCallback(
    (value: Saved) => {
      setBirth(initialBirth(value.birth));
      setName(value.displayName);
      setPrecise(!value.birth.timeUnknown && value.birth.hour !== undefined);
      prefilled.current = true;
    },
    [setBirth, setName, setPrecise],
  );
  useEffect(() => {
    let active = true;
    if (!signedIn && !hasInitial)
      void readAnonymous()
        .then((data) => {
          if (!active || !data?.profile) return;
          const value = { birth: data.profile, displayName: data.displayName ?? '' };
          setSaved(value);
          if (!embedded && !profileMode) setTarget((current) => current ?? 'other');
          if ((embedded ? prefillProfile : profileMode) && !dirty.current) fill(value);
        })
        .catch(() => {
          if (active) setError('report.storageError');
        });
    return () => {
      active = false;
    };
  }, [signedIn, hasInitial, embedded, profileMode, prefillProfile, dirty, fill, setError]);
  /** Switching an untouched form swaps between the saved profile and a blank form. */
  const choose = (next: BirthTarget) => {
    setTarget(next);
    if (dirty.current) return;
    if (next === 'self' && saved) fill(saved);
    else if (next === 'other' && prefilled.current) {
      setBirth(initialBirth());
      setName('');
      setPrecise(false);
      prefilled.current = false;
    }
  };
  return { target, setTarget, choose, hasSaved: saved !== null };
}
