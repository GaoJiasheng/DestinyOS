'use client';
import { useEffect, useState, type ComponentProps, type ComponentType } from 'react';
import type { DialogImpl } from './dialog-impl';

type DialogProps = ComponentProps<typeof DialogImpl>;
let Loaded: ComponentType<DialogProps> | null = null;
let pending: Promise<ComponentType<DialogProps>> | null = null;
function load() {
  pending ??= import('./dialog-impl').then((module) => (Loaded = module.DialogImpl));
  return pending;
}

/**
 * Accessible modal with focus trapping, labelled content, and translated controls.
 * The Radix primitive (~11KB gzip) is fetched on idle and mounted on first open,
 * keeping it out of every route's first-load JS.
 */
export function Dialog(props: DialogProps) {
  const [Impl, setImpl] = useState(() => Loaded);
  useEffect(() => {
    if (Impl) return;
    let live = true;
    const start = () => void load().then((component) => live && setImpl(() => component));
    if (props.open) start();
    else if (typeof window.requestIdleCallback === 'function') {
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
    return () => {
      live = false;
    };
  }, [Impl, props.open]);
  return Impl ? <Impl {...props} /> : null;
}
