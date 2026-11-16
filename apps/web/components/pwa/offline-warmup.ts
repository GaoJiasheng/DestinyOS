'use client';
import { readAnonymous } from '@/lib/anonymous-storage';
import { OFFLINE_SHELL_MESSAGE, offlineAssetPaths } from './use-offline-shell';

/** Names shared with public/sw.js; keep them in step. */
export const OFFLINE_CACHE = 'tianji-offline-reports-v1';
const MANIFEST = '/__offline/manifest.json';
/** Any URL-safe id maps to the shared per-system shell; this one never names a real reading. */
export const WARM_ID = 'offline-warmup';
const FAILED_KEY = 'tianji-offline-warm-failed';
// A refused or failed page request (an edge 429, a flaky network) pauses warming instead of retrying.
const FAILED_PAUSE = 30 * 60 * 1000;
const STATIC = /^\/(?:_next\/static|fonts)\//;

export type ChartLoaders = Partial<Record<string, () => Promise<unknown>>>;
export interface WarmTiming {
  /** Wait after a chart import so the browser has filed its resource timing entries. */
  settle: number;
  /** Pause between two systems, on top of waiting for an idle moment. */
  gap: number;
  /** Longest wait for the worker to finish one system. */
  reply: number;
}
const TIMING: WarmTiming = { settle: 500, gap: 3000, reply: 30_000 };

const shellKey = (locale: string, system: string) => `/__offline/shell/${locale}/${system}`;

/**
 * Systems with a device report whose shell for this locale is not stored yet, most recent reading
 * first. The page the visitor is on stores its own shell already, so its system is left out.
 */
export function pendingSystems(
  readings: readonly { system: string; createdAt: string }[],
  locale: string,
  stored: ReadonlySet<string>,
  current: string | null,
): string[] {
  const systems: string[] = [];
  for (const reading of [...readings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    if (
      /^[a-z]+$/.test(reading.system) &&
      reading.system !== current &&
      !systems.includes(reading.system) &&
      !stored.has(shellKey(locale, reading.system))
    )
      systems.push(reading.system);
  return systems;
}

async function storedShells(): Promise<Set<string>> {
  try {
    if (!(await caches.has(OFFLINE_CACHE))) return new Set();
    const response = await (await caches.open(OFFLINE_CACHE)).match(MANIFEST);
    const data = (response ? await response.json() : null) as {
      shells?: Record<string, { assets?: unknown[] }>;
    } | null;
    return new Set(
      Object.entries(data?.shells ?? {})
        .filter(([, shell]) => Array.isArray(shell?.assets) && shell.assets.length > 0)
        .map(([key]) => key),
    );
  } catch {
    return new Set();
  }
}

function pausedUntil(): number {
  try {
    return Number(localStorage.getItem(FAILED_KEY)) || 0;
  } catch {
    return 0;
  }
}
function pause() {
  try {
    localStorage.setItem(FAILED_KEY, String(Date.now() + FAILED_PAUSE));
  } catch {
    /* Storage is optional; the per-document guard still stops this run. */
  }
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });

/** Resolves on an idle moment while the page is visible and online; false once aborted. */
async function idle(signal: AbortSignal): Promise<boolean> {
  while (!signal.aborted && (document.visibilityState !== 'visible' || !navigator.onLine))
    await new Promise<void>((resolve) => {
      const done = () => {
        document.removeEventListener('visibilitychange', done);
        window.removeEventListener('online', done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      document.addEventListener('visibilitychange', done);
      window.addEventListener('online', done);
      signal.addEventListener('abort', done, { once: true });
    });
  if (signal.aborted) return false;
  await new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function')
      requestIdleCallback(() => resolve(), { timeout: 10_000 });
    else setTimeout(resolve, 1000);
  });
  return !signal.aborted && navigator.onLine;
}

/** Run the system's chart import and list every chunk, stylesheet and font this document has loaded. */
async function chunksFor(loader: (() => Promise<unknown>) | undefined, timing: WarmTiming) {
  const names = new Set<string>();
  let observer: PerformanceObserver | null = null;
  if (typeof PerformanceObserver !== 'undefined') {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) names.add(entry.name);
    });
    try {
      observer.observe({ type: 'resource' });
    } catch {
      observer = null;
    }
  }
  if (loader) await loader().catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, timing.settle));
  if (observer) {
    for (const entry of observer.takeRecords()) names.add(entry.name);
    observer.disconnect();
  }
  // Chunks this page loaded earlier (framework, report layout, shared chart code) are needed there too.
  for (const entry of performance.getEntriesByType('resource')) names.add(entry.name);
  return offlineAssetPaths(names, window.location.origin).filter((path) => STATIC.test(path));
}

/** Hand one shell to the worker and wait until it has stored it (or the reply times out). */
function store(worker: ServiceWorker, message: object, signal: AbortSignal, timing: WarmTiming) {
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(done, timing.reply);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      channel.port1.close();
      resolve();
    }
    channel.port1.onmessage = done;
    signal.addEventListener('abort', done, { once: true });
    worker.postMessage(message, [channel.port2]);
  });
}

const running = new Set<string>();
const finished = new Set<string>();

/**
 * Store the offline shell and chart chunks for every other system that has a device report, one
 * system at a time on idle moments, so those reports reopen offline without first being opened online.
 * Each system costs one anonymous page request (plus static files, mostly from the HTTP cache).
 */
export async function warmOfflineReports({
  locale,
  path,
  loaders,
  signal,
  timing = TIMING,
}: {
  locale: string;
  path: string;
  loaders: ChartLoaders;
  signal: AbortSignal;
  timing?: WarmTiming;
}): Promise<void> {
  if (running.has(locale) || finished.has(locale) || pausedUntil() > Date.now()) return;
  running.add(locale);
  try {
    const data = await readAnonymous().catch(() => null);
    if (!data?.readings.length || signal.aborted) return;
    const registration = await navigator.serviceWorker.ready;
    const current = /^\/(?:zh-TW|zh|en)\/([a-z]+)\/r\/local\//.exec(path)?.[1] ?? null;
    const todo = pendingSystems(data.readings, locale, await storedShells(), current);
    for (const system of todo) {
      if (!(await idle(signal))) return;
      const worker = registration.active;
      if (!worker) return;
      const assets = await chunksFor(loaders[system], timing);
      if (signal.aborted || !navigator.onLine) return;
      await store(
        worker,
        {
          type: OFFLINE_SHELL_MESSAGE,
          path: `/${locale}/${system}/r/local/${WARM_ID}`,
          shell: true,
          assets,
        },
        signal,
        timing,
      );
      if (signal.aborted) return;
      if (!(await storedShells()).has(shellKey(locale, system))) {
        pause();
        return;
      }
      await wait(timing.gap, signal);
    }
    if (!signal.aborted) finished.add(locale);
  } finally {
    running.delete(locale);
  }
}
