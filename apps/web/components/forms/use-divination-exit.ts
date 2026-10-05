'use client';
import { useEffect, type RefObject } from 'react';
/** Guard page exit while the casting ritual or a private question is in progress. */
export function useDivinationExit({
  question,
  step,
  system,
  completed,
  setExitHref,
  setLeaving,
}: {
  question: string;
  step: 'question' | 'ritual' | 'generating';
  system: 'iching' | 'qimen';
  completed: RefObject<boolean>;
  setExitHref: (value: string) => void;
  setLeaving: (value: boolean) => void;
}) {
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!completed.current && (question || step !== 'question' || system === 'qimen')) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (
        anchor &&
        anchor.origin === location.origin &&
        // DESIGN-GAP: Same-page anchors (including the skip link) move focus without leaving the ritual.
        !(
          anchor.pathname === location.pathname &&
          anchor.search === location.search &&
          anchor.hash
        ) &&
        !completed.current &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        setExitHref(anchor.href);
        setLeaving(true);
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
    };
  }, [question, step, system, completed, setExitHref, setLeaving]);
}
