import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { offlineAssetPaths } from '../components/pwa/use-offline-shell';

const origin = 'https://tianji.test';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const PLACEHOLDER = '00000000-0000-4000-8000-00000ff11e00';

type Listener = (event: Record<string, unknown>) => void;
interface Helpers {
  offlineRoute(path: string): { key: string; source: string; id: string | null } | null;
  offlineAsset(path: string): boolean;
  shellAssets(html: string): string[];
  postedAssets(list: unknown): string[];
  personalize(html: string, id: string | null): string;
}

/** In-memory Cache Storage keyed by absolute URL, enough for the worker's put/match/keys/delete. */
function memoryCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const key = (input: string | Request) =>
    new URL(typeof input === 'string' ? input : input.url, origin).href;
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      match: async (input: string | Request) => store.get(key(input))?.clone(),
      put: async (input: string | Request, response: Response) => {
        store.set(key(input), response);
      },
      delete: async (input: string | Request) => store.delete(key(input)),
      keys: async () => [...store.keys()].map((url) => new Request(url)),
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (input: string | Request) => {
      for (const store of stores.values()) {
        const hit = store.get(key(input));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
}

function basic(body: string, type = 'text/html; charset=utf-8', status = 200) {
  const response = new Response(body, { status, headers: { 'content-type': type } });
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
}

let listeners: Record<string, Listener>;
let helpers: Helpers;
let caches: ReturnType<typeof memoryCaches>;
let network: (url: string, init?: RequestInit) => Promise<Response>;
const requested: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  listeners = {};
  requested.length = 0;
  caches = memoryCaches();
  network = async () => {
    throw new TypeError('Failed to fetch');
  };
  const self = {
    location: new URL(`${origin}/sw.js`),
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
  };
  const fetch = (input: string | { url: string }, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.url, origin).href;
    requested.push({ url, init });
    return network(url, init);
  };
  helpers = new Function(
    'self',
    'caches',
    'fetch',
    `${source}\nreturn { offlineRoute, offlineAsset, shellAssets, postedAssets, personalize };`,
  )(self, caches, fetch) as Helpers;
});

async function navigate(path: string) {
  let answer: Promise<Response> | undefined;
  listeners.fetch!({
    request: { method: 'GET', url: `${origin}${path}`, mode: 'navigate' },
    respondWith: (value: Promise<Response>) => {
      answer = value;
    },
  });
  return answer;
}

async function post(path: string, assets: string[], shell = true) {
  let work: Promise<unknown> | undefined;
  listeners.message!({
    data: { type: 'tianji-offline-shell', path, shell, assets },
    source: { url: `${origin}${path}` },
    waitUntil: (value: Promise<unknown>) => {
      work = value;
    },
  });
  await work;
}

describe('offline device report matching', () => {
  it('accepts only device reports and the history list', () => {
    expect(helpers.offlineRoute('/zh/bazi/r/local/abc-123')).toMatchObject({
      key: '/__offline/shell/zh/bazi',
      source: `/zh/bazi/r/local/${PLACEHOLDER}`,
      id: 'abc-123',
    });
    expect(helpers.offlineRoute('/zh-TW/tarot/r/local/x_1/')?.key).toBe(
      '/__offline/shell/zh-TW/tarot',
    );
    expect(helpers.offlineRoute('/en/me/history')).toMatchObject({
      key: '/__offline/shell/en/history',
      id: null,
    });
    // Server-persisted reports carry personal data and are never kept.
    expect(helpers.offlineRoute('/zh/bazi/r/abc')).toBeNull();
    expect(helpers.offlineRoute('/zh/me')).toBeNull();
    expect(helpers.offlineRoute('/fr/bazi/r/local/abc')).toBeNull();
    // Ids are spliced into markup, so anything beyond URL-safe characters is refused.
    expect(helpers.offlineRoute('/zh/bazi/r/local/%3Cscript%3E')).toBeNull();
  });

  it('keeps static assets only', () => {
    expect(helpers.offlineAsset('/_next/static/chunks/app/[locale]/page-1a2b.js')).toBe(true);
    expect(helpers.offlineAsset('/_next/static/css/9f.css')).toBe(true);
    expect(helpers.offlineAsset('/fonts/noto-body-003.woff2')).toBe(true);
    expect(helpers.offlineAsset('/tarot/rws/cups_01.webp')).toBe(true);
    expect(helpers.offlineAsset('/api/v1/me')).toBe(false);
    expect(helpers.offlineAsset('/zh/bazi/r/local/x')).toBe(false);
  });

  it('finds chunks in markup and escaped Flight data', () => {
    const html =
      '<script src="/_next/static/chunks/webpack-1.js"></script><link href="/_next/static/css/a.css">' +
      '<script>self.__next_f.push([1,"5:I[123,[\\"456\\",\\"static/chunks/456-ab.js\\"],\\"LocalReport\\"]"])</script>' +
      '<link rel="preload" href="/fonts/noto-ui.woff2">';
    expect(helpers.shellAssets(html).sort()).toEqual([
      '/_next/static/chunks/456-ab.js',
      '/_next/static/chunks/webpack-1.js',
      '/_next/static/css/a.css',
      '/fonts/noto-ui.woff2',
    ]);
  });

  it('drops posted resources from other origins and non-static paths', () => {
    expect(
      helpers.postedAssets([
        `${origin}/_next/static/chunks/1.js`,
        'https://pagead2.googlesyndication.com/x.js',
        `${origin}/api/v1/session`,
        42,
      ]),
    ).toEqual(['/_next/static/chunks/1.js']);
    expect(helpers.postedAssets('nope')).toEqual([]);
  });

  it('client reports same-origin static resources once', () => {
    expect(
      offlineAssetPaths(
        [
          `${origin}/_next/static/chunks/1.js`,
          `${origin}/_next/static/chunks/1.js`,
          `${origin}/zh/me/history`,
          'https://example.com/_next/static/chunks/1.js',
        ],
        origin,
      ),
    ).toEqual(['/_next/static/chunks/1.js']);
  });
});

describe('offline device report caching', () => {
  const shell = `<html><script src="/_next/static/chunks/main-1.js"></script><p data-id="${PLACEHOLDER}"></p></html>`;
  const history = '<html><script src="/_next/static/chunks/history-1.js"></script></html>';
  beforeEach(() => {
    network = async (url) => {
      if (url.endsWith(`/r/local/${PLACEHOLDER}`)) return basic(shell);
      if (url.endsWith('/zh/me/history')) return basic(history);
      if (url.includes('/_next/static/')) return basic('js', 'text/javascript');
      throw new TypeError('Failed to fetch');
    };
  });

  it('stores an anonymous page, its chunks and the history list, then answers offline with the id', async () => {
    await post('/zh/bazi/r/local/first-report', [`${origin}/_next/static/chunks/chart-9.js`]);
    const shells = requested.filter((r) => !r.url.includes('/_next/'));
    expect(shells.map((r) => r.url)).toEqual([
      `${origin}/zh/bazi/r/local/${PLACEHOLDER}`,
      `${origin}/zh/me/history`,
    ]);
    expect(shells.every((r) => r.init?.credentials === 'omit')).toBe(true);
    const store = caches.stores.get('tianji-offline-reports-v1')!;
    for (const path of [
      '/_next/static/chunks/main-1.js',
      '/_next/static/chunks/chart-9.js',
      '/_next/static/chunks/history-1.js',
    ])
      expect(store.has(`${origin}${path}`)).toBe(true);
    // No real report address is ever a cache key.
    expect([...store.keys()].some((url) => url.includes('/r/local/'))).toBe(false);

    network = async () => {
      throw new TypeError('Failed to fetch');
    };
    const page = await (await navigate('/zh/bazi/r/local/another-report'))!;
    expect(page.status).toBe(200);
    const text = await page.text();
    expect(text).toContain('data-id="another-report"');
    expect(text).not.toContain(PLACEHOLDER);
    expect(await (await (await navigate('/zh/me/history'))!).text()).toBe(history);
  });

  it('does not refetch a fresh page on every visit', async () => {
    await post('/zh/bazi/r/local/a', []);
    const count = requested.length;
    await post('/zh/bazi/r/local/b', []);
    expect(requested.length).toBe(count);
  });

  it('online responses pass through untouched', async () => {
    network = async () => basic('<html>live</html>');
    expect(await (await (await navigate('/zh/bazi/r/local/a'))!).text()).toBe('<html>live</html>');
  });

  it('never stores a page the server did not answer with plain HTML', async () => {
    network = async (url) =>
      url.includes('/r/local/') ? basic('nope', 'text/html', 404) : basic('js', 'text/javascript');
    await post('/zh/bazi/r/local/a', []);
    const store = caches.stores.get('tianji-offline-reports-v1')!;
    expect(store.has(`${origin}/__offline/shell/zh/bazi`)).toBe(false);
  });
});
