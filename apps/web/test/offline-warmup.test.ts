import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readings = vi.hoisted(() => ({
  list: [] as { id: string; system: string; createdAt: string }[],
}));
vi.mock('@/lib/anonymous-storage', () => ({
  readAnonymous: async () => ({ anonId: 'a', readings: readings.list, settings: {} }),
}));

const origin = 'https://tianji.test';
const reading = (system: string, createdAt: string) => ({ id: system, system, createdAt });

describe('which systems are warmed', () => {
  it('keeps one entry per system, newest first, skipping stored shells and the current page', async () => {
    const { pendingSystems } = await import('../components/pwa/offline-warmup');
    const list = [
      reading('bazi', '2026-11-01T00:00:00.000Z'),
      reading('ziwei', '2026-11-03T00:00:00.000Z'),
      reading('numerology', '2026-11-02T00:00:00.000Z'),
      reading('ziwei', '2026-10-01T00:00:00.000Z'),
      reading('tarot', '2026-11-04T00:00:00.000Z'),
    ];
    expect(pendingSystems(list, 'zh', new Set(['/__offline/shell/zh/tarot']), 'bazi')).toEqual([
      'ziwei',
      'numerology',
    ]);
    // Shells are per language: an English shell does not cover the Chinese page.
    expect(pendingSystems(list, 'en', new Set(['/__offline/shell/zh/tarot']), null)).toEqual([
      'tarot',
      'ziwei',
      'numerology',
      'bazi',
    ]);
  });

  it('uses the same cache name and message as the service worker', async () => {
    const { OFFLINE_CACHE } = await import('../components/pwa/offline-warmup');
    const { OFFLINE_SHELL_MESSAGE } = await import('../components/pwa/use-offline-shell');
    const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
    expect(worker).toContain(`const OFFLINE = '${OFFLINE_CACHE}';`);
    expect(worker).toContain(`const OFFLINE_MESSAGE = '${OFFLINE_SHELL_MESSAGE}';`);
  });
});

describe('warming run', () => {
  let manifest: Record<string, { at: number; assets: string[] }>;
  let posted: { path: string; assets: string[] }[];
  let storeWorks: boolean;
  let storage: Map<string, string>;
  const loaded: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    manifest = {};
    posted = [];
    storeWorks = true;
    storage = new Map();
    loaded.length = 0;
    const worker = {
      postMessage(message: { path: string; assets: string[] }, [port]: MessagePort[]) {
        posted.push(message);
        const system = /^\/zh\/([a-z]+)\//.exec(message.path)![1];
        if (storeWorks) manifest[`/__offline/shell/zh/${system}`] = { at: 1, assets: ['/x.js'] };
        port!.postMessage(true);
      },
    };
    vi.stubGlobal('navigator', {
      onLine: true,
      serviceWorker: { ready: Promise.resolve({ active: worker }) },
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener() {},
      removeEventListener() {},
    });
    vi.stubGlobal('window', {
      location: new URL(`${origin}/zh/bazi/r/local/b`),
      addEventListener() {},
      removeEventListener() {},
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal('PerformanceObserver', undefined);
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => setTimeout(callback, 0));
    vi.stubGlobal('performance', {
      getEntriesByType: () =>
        [
          '/_next/static/chunks/main-1.js',
          '/_next/static/css/a.css',
          '/fonts/noto-ui.woff2',
          '/art/systems/bazi.webp',
          '/api/v1/session',
          ...loaded,
        ].map((path) => ({ name: `${origin}${path}` })),
    });
    vi.stubGlobal('caches', {
      has: async () => true,
      open: async () => ({
        match: async () => new Response(JSON.stringify({ shells: manifest })),
      }),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const timing = { settle: 0, gap: 0, reply: 1000 };

  it('warms each missing system once with its chart chunk, in order', async () => {
    const { warmOfflineReports, WARM_ID } = await import('../components/pwa/offline-warmup');
    readings.list = [
      reading('bazi', '2026-11-05T00:00:00.000Z'),
      reading('ziwei', '2026-11-04T00:00:00.000Z'),
      reading('tarot', '2026-11-03T00:00:00.000Z'),
    ];
    manifest['/__offline/shell/zh/tarot'] = { at: 1, assets: ['/y.js'] };
    const loaders = {
      ziwei: async () => {
        loaded.push('/_next/static/chunks/ziwei-9.js');
      },
    };
    const signal = new AbortController().signal;
    await warmOfflineReports({ locale: 'zh', path: '/zh/bazi/r/local/b', loaders, signal, timing });
    expect(posted.map((message) => message.path)).toEqual([`/zh/ziwei/r/local/${WARM_ID}`]);
    expect(posted[0]!.assets).toEqual([
      '/_next/static/chunks/main-1.js',
      '/_next/static/css/a.css',
      '/fonts/noto-ui.woff2',
      '/_next/static/chunks/ziwei-9.js',
    ]);
    // A second run in the same document sends nothing.
    await warmOfflineReports({ locale: 'zh', path: '/zh/bazi/r/local/b', loaders, signal, timing });
    expect(posted).toHaveLength(1);
  });

  it('stops after a shell that could not be stored and pauses later runs', async () => {
    const { warmOfflineReports } = await import('../components/pwa/offline-warmup');
    readings.list = [
      reading('ziwei', '2026-11-04T00:00:00.000Z'),
      reading('numerology', '2026-11-03T00:00:00.000Z'),
    ];
    storeWorks = false;
    const signal = new AbortController().signal;
    await warmOfflineReports({ locale: 'zh', path: '/zh/me', loaders: {}, signal, timing });
    expect(posted).toHaveLength(1);
    expect(Number(storage.get('tianji-offline-warm-failed'))).toBeGreaterThan(Date.now());
    vi.resetModules();
    const fresh = await import('../components/pwa/offline-warmup');
    storeWorks = true;
    await fresh.warmOfflineReports({ locale: 'zh', path: '/zh/me', loaders: {}, signal, timing });
    expect(posted).toHaveLength(1);
  });

  it('sends nothing once the page has gone away or offline', async () => {
    const { warmOfflineReports } = await import('../components/pwa/offline-warmup');
    readings.list = [reading('ziwei', '2026-11-04T00:00:00.000Z')];
    const controller = new AbortController();
    controller.abort();
    await warmOfflineReports({
      locale: 'zh',
      path: '/zh/me',
      loaders: {},
      signal: controller.signal,
      timing,
    });
    expect(posted).toHaveLength(0);
  });
});
