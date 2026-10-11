import { afterEach, expect, it, vi } from 'vitest';
import { publicCacheRequest, publicCachedFetch } from '../lib/platform/public-cache';
import { publicCacheKey } from '../lib/platform/public-cache';
function memoryCache() {
  const objects = new Map<string, { body: ArrayBuffer; response: Response }>();
  return {
    match: vi.fn(async (request: Request) => {
      const value = objects.get(request.url);
      return value ? new Response(value.body.slice(0), value.response) : undefined;
    }),
    put: vi.fn(async (request: Request, response: Response) => {
      objects.set(request.url, { body: await response.arrayBuffer(), response });
    }),
  } as unknown as Cache;
}
afterEach(() => vi.useRealTimers());
it('isolates HTML, Flight, locale, router state and prefetch while ignoring the opaque _rsc token', async () => {
  const request = (query: string, headers: Record<string, string> = {}, locale = 'zh') =>
    new Request(`https://example.test/${locale}/learn${query}`, { headers });
  const flight = { RSC: '1', 'Next-Router-State-Tree': 'public-tree' };
  expect(publicCacheRequest(request('?_rsc=a', flight))).toBe(true);
  const a = await publicCacheKey(request('?_rsc=a', flight));
  const b = await publicCacheKey(request('?_rsc=b', flight));
  expect(a.url).toBe(b.url);
  for (const variant of [
    request(''),
    request('?_rsc=a', { ...flight, 'Next-Router-Prefetch': '1' }),
    request('?_rsc=a', { ...flight, 'Next-Router-State-Tree': 'different' }),
    request('?_rsc=a', flight, 'en'),
  ])
    expect((await publicCacheKey(variant)).url).not.toBe(a.url);
  expect(publicCacheRequest(request('?_rsc=a&private=true', flight))).toBe(false);
  expect(
    publicCacheRequest(request('?_rsc=a', { ...flight, cookie: 'authjs.session-token.0=secret' })),
  ).toBe(false);
});
it('stores and hits both full navigation and Next-Router-Prefetch responses without mixing them', async () => {
  const cache = memoryCache();
  const pending: Promise<unknown>[] = [];
  const dispatch = vi.fn(
    async (request: Request) =>
      new Response(request.headers.get('next-router-prefetch') ? 'prefetch' : 'navigation', {
        headers: { 'Content-Type': 'text/x-component' },
      }),
  );
  for (const prefetch of [false, true]) {
    const request = new Request('https://example.test/zh/learn?_rsc=1', {
      headers: { RSC: '1', ...(prefetch ? { 'Next-Router-Prefetch': '1' } : {}) },
    });
    const first = await publicCachedFetch(request, cache, (p) => pending.push(p), dispatch);
    expect(first.headers.get('X-Destiny-Cache')).toBe('MISS');
    await Promise.all(pending);
    const hit = await publicCachedFetch(request, cache, (p) => pending.push(p), dispatch);
    expect(hit.headers.get('X-Destiny-Cache')).toBe('HIT');
    expect(hit.headers.get('Cache-Control')).toContain('s-maxage=3600');
    expect(await hit.text()).toBe(prefetch ? 'prefetch' : 'navigation');
  }
  expect(dispatch).toHaveBeenCalledTimes(2);
});
it('isolates actions, auth, queries, range and private routes from public cache', () => {
  for (const path of [
    '/zh',
    '/en/tarot',
    '/zh-TW/learn/bazi/articles/day-master',
    '/zh/privacy',
    '/zh/qimen',
  ])
    expect(publicCacheRequest(new Request(`https://example.test${path}`))).toBe(true);
  for (const path of [
    '/zh/me',
    '/api/auth/session',
    '/zh/tarot/reading',
    '/zh/bazi/new',
    '/zh/bazi/r/a',
    '/zh?x=1',
    '/zh/',
  ])
    expect(publicCacheRequest(new Request(`https://example.test${path}`))).toBe(false);
  const variants: Record<string, string>[] = [
    { 'next-router-state-tree': 'tree' },
    { 'next-action': 'action' },
    { 'x-isr': '1' },
    { authorization: 'Bearer secret' },
    { range: 'bytes=0-1' },
    { cookie: '__Secure-authjs.session-token=secret' },
    { cookie: 'age_gate=blocked' },
    { accept: 'text/x-component' },
  ];
  for (const headers of variants)
    expect(publicCacheRequest(new Request('https://example.test/zh', { headers }))).toBe(false);
  expect(publicCacheRequest(new Request('https://example.test/zh', { method: 'POST' }))).toBe(
    false,
  );
});
it('serves cached public HTML without Next, strips only the locale cookie, and performs background SWR', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const cache = memoryCache();
  const pending: Promise<unknown>[] = [];
  const waitUntil = (promise: Promise<unknown>) => {
    pending.push(promise);
  };
  const dispatch = vi.fn(
    async () =>
      new Response('public', {
        headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'NEXT_LOCALE=zh; Path=/' },
      }),
  );
  const request = new Request('https://example.test/zh');
  const first = await publicCachedFetch(request, cache, waitUntil, dispatch);
  expect(first.headers.get('set-cookie')).toBeNull();
  expect(first.headers.get('X-Destiny-Cache')).toBe('MISS');
  expect(await first.text()).toBe('public');
  await Promise.all(pending);
  const hit = await publicCachedFetch(request, cache, waitUntil, dispatch);
  expect(hit.headers.get('X-Destiny-Cache')).toBe('HIT');
  expect(hit.headers.get('Cache-Control')).toContain('s-maxage=3600');
  expect(dispatch).toHaveBeenCalledOnce();
  vi.setSystemTime(Date.now() + 3601_000);
  const stale = await publicCachedFetch(request, cache, waitUntil, dispatch);
  expect(stale.headers.get('X-Destiny-Cache')).toBe('STALE');
  await Promise.all(pending);
  expect(dispatch).toHaveBeenCalledTimes(2);
  expect(await stale.text()).toBe('public');
});
it('never stores redirects, errors, RSC, private HTML, or responses carrying auth cookies', async () => {
  for (const response of [
    new Response('redirect', { status: 302 }),
    new Response('error', { status: 503 }),
    new Response('rsc', { headers: { 'Content-Type': 'text/x-component' } }),
    new Response('private', {
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'private, no-store' },
    }),
    new Response('secret', {
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'authjs.session-token=secret' },
    }),
  ]) {
    const cache = memoryCache();
    const result = await publicCachedFetch(
      new Request('https://example.test/zh'),
      cache,
      () => undefined,
      async () => response,
    );
    expect(result).toBe(response);
    expect(cache.put).not.toHaveBeenCalled();
  }
});
it('continues serving when Cache API reads or writes fail', async () => {
  const cache = {
    match: async () => {
      throw new Error('cache unavailable');
    },
    put: async () => {
      throw new Error('cache unavailable');
    },
  } as unknown as Cache;
  const pending: Promise<unknown>[] = [];
  const response = await publicCachedFetch(
    new Request('https://example.test/zh'),
    cache,
    (p) => pending.push(p),
    async () => new Response('available', { headers: { 'Content-Type': 'text/html' } }),
  );
  expect(await response.text()).toBe('available');
  await expect(Promise.all(pending)).resolves.toBeDefined();
});
