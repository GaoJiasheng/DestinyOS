'use client';
import { useEffect, type RefObject } from 'react';
/**
 * Guard page exit while the visitor has typed a question, changed the category or started the
 * ritual; an untouched form lets links and reloads through untouched.
 */
export function useDivinationExit({
  dirty,
  completed,
  setExitHref,
  setLeaving,
}: {
  dirty: boolean;
  completed: RefObject<boolean>;
  setExitHref: (value: string) => void;
  setLeaving: (value: boolean) => void;
}) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!completed.current) {
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
  }, [dirty, completed, setExitHref, setLeaving]);
}
