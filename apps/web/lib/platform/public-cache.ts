import type { KVNamespace } from '@cloudflare/workers-types';
export const publicCacheControl = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=300';
const publicPath =
  /^\/(zh|en|zh-TW)(?:\/(?:bazi|ziwei|iching|qimen|tarot|astrology|vedic|numerology|today|about|faq|privacy|terms|disclaimer|contact|credits)|\/learn(?:\/[a-zA-Z0-9._-]+)*)?$/;
/** Recognize public HTML/RSC only; actions, sessions and private data always bypass storage. */
export function publicCacheRequest(request: Request): boolean {
  const url = new URL(request.url);
  const rsc = request.headers.get('rsc') === '1';
  return (
    request.method === 'GET' &&
    (!url.search || (rsc && [...url.searchParams.keys()].every((key) => key === '_rsc'))) &&
    publicPath.test(url.pathname) &&
    !request.headers.has('authorization') &&
    !request.headers.has('range') &&
    (!request.headers.has('rsc') || rsc) &&
    (!request.headers.has('next-router-state-tree') || rsc) &&
    (request.headers.get('next-router-state-tree')?.length ?? 0) <= 16384 &&
    !request.headers.has('next-router-segment-prefetch') &&
    !request.headers.has('next-action') &&
    !request.headers.has('x-prerender-revalidate') &&
    !request.headers.has('x-isr') &&
    !/(?:authjs|next-auth)\.[^=]*session-token(?:\.\d+)?=|age_gate=blocked/.test(
      request.headers.get('cookie') ?? '',
    ) &&
    (!(request.headers.get('accept') ?? '').includes('text/x-component') || rsc)
  );
}
/** Hash variant headers instead of permitting Vary to mix document, prefetch and partial Flight responses. */
export async function publicCacheKey(request: Request): Promise<Request> {
  const url = new URL(request.url);
  url.searchParams.delete('_rsc');
  const values = [
    'rsc',
    'next-router-state-tree',
    'next-router-prefetch',
    'next-url',
    'purpose',
  ].map((key) => [key, request.headers.get(key) ?? '']);
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(values)),
  );
  url.searchParams.set(
    '__destiny_variant',
    Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  );
  return new Request(url);
}
/** Strip only next-intl's public language preference; reject every other Set-Cookie and private/non-HTML response. */
export function cacheablePublicResponse(response: Response, request?: Request): Response | null {
  if (
    response.status !== 200 ||
    !response.headers
      .get('content-type')
      ?.includes(request?.headers.get('rsc') === '1' ? 'text/x-component' : 'text/html') ||
    /private|no-store/i.test(response.headers.get('cache-control') ?? '')
  )
    return null;
  const cookies = response.headers.getSetCookie();
  if (cookies.some((cookie) => !cookie.startsWith('NEXT_LOCALE='))) return null;
  const headers = new Headers(response.headers);
  headers.delete('set-cookie');
  headers.set('Cache-Control', publicCacheControl);
  return new Response(response.body, { status: response.status, headers });
}
/** Serve one-hour public HTML with explicit SWR because Workers Cache API does not implement SWR directives. */
export async function publicCachedFetch(
  request: Request,
  cache: Cache | undefined,
  waitUntil: (pending: Promise<unknown>) => void,
  dispatch: (request: Request) => Promise<Response>,
  global?: { store: Pick<KVNamespace, 'get' | 'put'>; version: string },
): Promise<Response> {
  const key = await publicCacheKey(request);
  const digest = global
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key.url))
    : null;
  // DESIGN-GAP: KV is the global second level; versioned identities and all existing variant/private guards remain intact across colo drift.
  const globalKey =
    global && digest
      ? `public-response:${global.version}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
      : null;
  const match = await cache?.match(key).catch(() => undefined);
  let cached = match ? new Response(match.body, match) : undefined;
  let globalHit = false;
  if (!cached && global && globalKey) {
    const saved = await global.store.get(globalKey).catch(() => null);
    if (saved) {
      try {
        const value: unknown = JSON.parse(saved);
        if (
          value &&
          typeof value === 'object' &&
          'body' in value &&
          'headers' in value &&
          typeof value.body === 'string' &&
          Array.isArray(value.headers) &&
          value.headers.every(
            (entry: unknown) =>
              Array.isArray(entry) &&
              entry.length === 2 &&
              entry.every((item: unknown) => typeof item === 'string'),
          )
        ) {
          const response = new Response(value.body, {
            headers: value.headers as [string, string][],
          });
          const timestamp = Number(response.headers.get('X-Destiny-Stored-At'));
          if (
            timestamp > 0 &&
            timestamp <= Date.now() &&
            Date.now() - timestamp < 3900_000 &&
            !response.headers.has('set-cookie') &&
            cacheablePublicResponse(response, request)
          ) {
            cached = response;
            globalHit = true;
            if (cache) waitUntil(cache.put(key, response.clone()).catch(() => undefined));
          }
        }
      } catch {
        /* Corrupt global objects are misses, never private response fallbacks. */
      }
    }
  }
  const refresh = async () => {
    const response = await dispatch(request);
    const candidate = cacheablePublicResponse(response, request);
    if (!candidate) return response;
    const stored = candidate.clone();
    // DESIGN-GAP: Keep the object for freshness+SWR, but expose only the one-hour freshness policy to downstream caches.
    stored.headers.set('Cache-Control', 'public, max-age=3900');
    stored.headers.set('X-Destiny-Stored-At', String(Date.now()));
    if (global && globalKey) {
      const snapshot = stored.clone();
      waitUntil(
        snapshot
          .text()
          .then(async (body) => {
            // DESIGN-GAP: Bound shared response objects to 1MiB; oversized responses remain uncached globally.
            if (new TextEncoder().encode(body).byteLength <= 1_048_576)
              await global.store.put(
                globalKey,
                JSON.stringify({ body, headers: [...snapshot.headers] }),
                { expirationTtl: 3900 },
              );
          })
          .catch(() => undefined),
      );
    }
    if (cache) waitUntil(cache.put(key, stored).catch(() => undefined));
    candidate.headers.set('X-Destiny-Cache', 'MISS');
    return candidate;
  };
  if (cached) {
    const storedAt = Number(cached.headers.get('X-Destiny-Stored-At'));
    const age = (Date.now() - storedAt) / 1000;
    if (storedAt > 0 && age < 3900) {
      if (age >= 3600)
        waitUntil(
          refresh()
            .then((response) => response.body?.cancel())
            .catch(() => undefined),
        );
      cached.headers.delete('X-Destiny-Stored-At');
      cached.headers.delete('Server-Timing');
      cached.headers.set('Cache-Control', publicCacheControl);
      cached.headers.set('Age', String(Math.max(0, Math.floor(age))));
      cached.headers.set('X-Destiny-Cache', age >= 3600 ? 'STALE' : globalHit ? 'KV-HIT' : 'HIT');
      return cached;
    }
  }
  return refresh();
}
