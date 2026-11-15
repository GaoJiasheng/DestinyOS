'use client';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { clearDraft, readDraft, setUrlStep, urlStep, writeDraft } from '@/lib/birth-form-draft';
/** Session draft plus browser-history step for a two-step form.
 * `restore` returns whether the restored draft may reopen on step two. */
export function useBirthDraft<T extends { step: 1 | 2 }>({
  slot,
  basis,
  dirty,
  snapshot,
  restore,
  setStep,
}: {
  slot: string | null;
  basis: string;
  dirty: MutableRefObject<boolean>;
  snapshot: T;
  restore: (draft: T) => boolean;
  setStep: (step: 1 | 2) => void;
}) {
  const restoreRef = useRef(restore);
  useEffect(() => {
    restoreRef.current = restore;
  });
  const skipWrite = useRef(false);
  const done = useRef(false);
  useEffect(() => {
    if (!slot) return;
    const wantsStepTwo = urlStep() === 2;
    const draft = readDraft<T>(slot, basis);
    let stepTwo = false;
    if (draft) {
      dirty.current = true;
      // The write effect in this same commit still sees the pre-restore state.
      skipWrite.current = true;
      stepTwo = restoreRef.current(draft) && wantsStepTwo;
    }
    if (stepTwo) setStep(2);
    else if (wantsStepTwo) setUrlStep(1, 'replace');
    const sync = () => setStep(urlStep());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [slot, basis, dirty, setStep]);
  const json = JSON.stringify(snapshot);
  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    if (slot && dirty.current && !done.current) writeDraft(slot, basis, JSON.parse(json));
  }, [slot, basis, json, dirty]);
  return {
    clear: () => {
      done.current = true;
      if (slot) clearDraft(slot);
    },
  };
}
