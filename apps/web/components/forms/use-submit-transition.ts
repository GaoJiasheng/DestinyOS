'use client';
import { useRef, useTransition } from 'react';
/** Acquire a synchronous lock before scheduling an async form/action transition. */
export function useSubmitTransition() {
  const locked = useRef(false);
  const [pending, start] = useTransition();
  const run = (task: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    start(async () => {
      try {
        await task();
      } finally {
        locked.current = false;
      }
    });
  };
  return { pending, run };
}

/** Preserve the documented casting ritual delay, in milliseconds, inside an async transition. */
export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
