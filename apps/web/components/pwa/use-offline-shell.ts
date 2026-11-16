'use client';
import { useEffect } from 'react';

/** Message understood by public/sw.js; keep the two in step. */
export const OFFLINE_SHELL_MESSAGE = 'tianji-offline-shell';
const STATIC = /^\/(?:_next\/static\/|fonts\/|art\/|tarot\/)/;
const BATCH_MS = 1500;

/** Same-origin static resources this document loaded, as paths; pages, APIs and other hosts are left out. */
export function offlineAssetPaths(names: Iterable<string>, origin: string): string[] {
  const paths = new Set<string>();
  for (const name of names) {
    try {
      const url = new URL(name, origin);
      if (url.origin === origin && STATIC.test(url.pathname)) paths.add(url.pathname + url.search);
    } catch {
      /* Not a URL. */
    }
  }
  return [...paths];
}

/**
 * Ask the service worker to keep an anonymous copy of this page and the chunks, fonts and art it
 * actually loaded, so a device report reopens offline. Later lazy chunks (charts, panels) are
 * reported in small batches as they arrive. Nothing is sent while offline or before `ready`.
 */
export function useOfflineShell(ready: boolean) {
  useEffect(() => {
    if (
      !ready ||
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator) ||
      typeof PerformanceObserver === 'undefined'
    )
      return;
    // Captured now: a batch flushed on unmount after a soft navigation still belongs to this page.
    const path = window.location.pathname;
    let live = true;
    let shell = true;
    let timer = 0;
    const pending = new Set<string>();
    const flush = () => {
      timer = 0;
      if (!navigator.onLine || (!shell && !pending.size)) return;
      const message = {
        type: OFFLINE_SHELL_MESSAGE,
        path,
        shell,
        assets: offlineAssetPaths(pending, window.location.origin),
      };
      shell = false;
      pending.clear();
      void navigator.serviceWorker.ready
        .then((registration) => registration.active?.postMessage(message))
        .catch(() => undefined);
    };
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) pending.add(entry.name);
      if (live && !timer) timer = window.setTimeout(flush, BATCH_MS);
    });
    try {
      // Buffered entries include the framework chunks fetched before this route mounted.
      observer.observe({ type: 'resource', buffered: true });
    } catch {
      observer.disconnect();
      return;
    }
    if (!timer) timer = window.setTimeout(flush, BATCH_MS);
    return () => {
      live = false;
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
      if (pending.size) flush();
    };
  }, [ready]);
}
