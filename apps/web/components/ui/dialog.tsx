'use client';
import { useEffect, useState, type ComponentProps, type ComponentType } from 'react';
import type { DialogImpl } from './dialog-impl';

type DialogProps = ComponentProps<typeof DialogImpl>;
let Loaded: ComponentType<DialogProps> | null = null;
let pending: Promise<ComponentType<DialogProps>> | null = null;
function load() {
  // A failed chunk request (offline, deploy in progress) must not poison later attempts.
  pending ??= import('./dialog-impl').then(
    (module) => (Loaded = module.DialogImpl),
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}
const RETRY_MS = 1500;
const MAX_ATTEMPTS = 4;

/**
 * Accessible modal with focus trapping, labelled content, and translated controls.
 * The Radix primitive (~11KB gzip) is fetched on idle and mounted on first open,
 * keeping it out of every route's first-load JS.
 */
export function Dialog(props: DialogProps) {
  const [Impl, setImpl] = useState(() => Loaded);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (Impl) return;
    let live = true;
    let retry = 0;
    const start = () =>
      void load().then(
        (component) => live && setImpl(() => component),
        () => {
          // Retry while the dialog is wanted, so a control that opens it is never dead for good.
          if (live && props.open && attempt < MAX_ATTEMPTS)
            retry = window.setTimeout(() => setAttempt(attempt + 1), RETRY_MS);
        },
      );
    if (props.open) {
      start();
      return () => {
        live = false;
        window.clearTimeout(retry);
      };
    } else if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => {
        live = false;
        window.cancelIdleCallback(id);
      };
    } else {
      const id = window.setTimeout(start, 2000);
      return () => {
        live = false;
        window.clearTimeout(id);
      };
    }
  }, [Impl, props.open, attempt]);
  return Impl ? <Impl {...props} /> : null;
}
