export const publicCacheControl = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=300';
const publicPath =
  /^\/(zh|en|zh-TW)(?:\/(?:bazi|ziwei|iching|qimen|tarot|astrology|vedic|numerology|about|faq|privacy|terms|disclaimer|contact|credits)|\/learn(?:\/[a-z0-9-]+)*)?$/;
/** Cache canonical public document navigations only; RSC, actions and personalized requests keep their original semantics. */
export function publicCacheRequest(request: Request): boolean {
  const url = new URL(request.url);
  return (
    request.method === 'GET' &&
    !url.search &&
    publicPath.test(url.pathname) &&
    !request.headers.has('authorization') &&
    !request.headers.has('range') &&
    !request.headers.has('rsc') &&
    !request.headers.has('next-router-state-tree') &&
    !request.headers.has('next-action') &&
    !request.headers.has('x-prerender-revalidate') &&
    !request.headers.has('x-isr') &&
    !/(?:authjs|next-auth)\.[^=]*session-token=|age_gate=blocked/.test(
      request.headers.get('cookie') ?? '',
    ) &&
    !(request.headers.get('accept') ?? '').includes('text/x-component')
  );
}
/** Strip only next-intl's public language preference; reject every other Set-Cookie and private/non-HTML response. */
export function cacheablePublicResponse(response: Response): Response | null {
  if (
    response.status !== 200 ||
    !response.headers.get('content-type')?.includes('text/html') ||
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
  cache: Cache,
  waitUntil: (pending: Promise<unknown>) => void,
  dispatch: (request: Request) => Promise<Response>,
): Promise<Response> {
  const key = new Request(request.url);
  const match = await cache.match(key).catch(() => undefined);
  const cached = match ? new Response(match.body, match) : undefined;
  const refresh = async () => {
    const response = await dispatch(request);
    const candidate = cacheablePublicResponse(response);
    if (!candidate) return response;
    const stored = candidate.clone();
    // DESIGN-GAP: Keep the object for freshness+SWR, but expose only the one-hour freshness policy to downstream caches.
    stored.headers.set('Cache-Control', 'public, max-age=3900');
    stored.headers.set('X-Destiny-Stored-At', String(Date.now()));
    waitUntil(cache.put(key, stored).catch(() => undefined));
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
      cached.headers.set('X-Destiny-Cache', age >= 3600 ? 'STALE' : 'HIT');
      return cached;
    }
  }
  return refresh();
}
