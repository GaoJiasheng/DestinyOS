import { isStaticPublicPath } from './static-public-path';
// Next encodes each segment as an URL-safe key, so traversal or query syntax is never a valid request.
const segmentRequest = /^(?:\/[\w$!@~-]+)+$/;
/** Map public Flight GETs to immutable assets without changing actions, APIs or private navigation. */
export function staticFlightUrl(input: RequestInfo | URL, init?: RequestInit): URL | null {
  const request = input instanceof Request ? input : null;
  const headers = new Headers(init?.headers ?? request?.headers);
  const method = init?.method ?? request?.method ?? 'GET';
  const url = new URL(request?.url ?? String(input), location.href);
  if (
    method !== 'GET' ||
    url.origin !== location.origin ||
    headers.get('rsc') !== '1' ||
    headers.has('next-action') ||
    headers.has('authorization') ||
    headers.has('range') ||
    headers.has('x-prerender-revalidate') ||
    headers.has('x-isr') ||
    [...url.searchParams.keys()].some(
      (key) =>
        key !== '_rsc' && !(key === 'date' && /^\/(?:zh|en|zh-TW)\/today$/.test(url.pathname)),
    ) ||
    !isStaticPublicPath(url.pathname)
  )
    return null;
  // DESIGN-GAP: The daily date is read by the client island; all dates share the same public Flight shell while the router retains the original query.
  const segment = headers.get('next-router-segment-prefetch');
  if (segment && segment !== '/_full' && !segmentRequest.test(segment)) return null;
  // DESIGN-GAP: Next 16 prefetches a route tree and individual segments; each maps to its build-emitted file, and only a whole-page request uses the full Flight.
  url.pathname +=
    segment && segment !== '/_full'
      ? `.${segment.slice(1).replaceAll('/', '.')}.segment.rsc`
      : '.rsc';
  url.search = '';
  return url;
}
/** Put public-shell actions on an unmatched URL because Static Assets returns 405 for POSTs to existing HTML. */
export function staticActionUrl(input: RequestInfo | URL, init?: RequestInit): URL | null {
  const request = input instanceof Request ? input : null;
  const headers = new Headers(init?.headers ?? request?.headers);
  const url = new URL(request?.url ?? String(input), location.href);
  if (
    (init?.method ?? request?.method ?? 'GET') !== 'POST' ||
    !headers.has('next-action') ||
    url.origin !== location.origin ||
    !isStaticPublicPath(url.pathname)
  )
    return null;
  url.pathname = '/_actions' + url.pathname;
  return url;
}
/** Install before router hydration so viewport prefetch also uses the asset URL. */
export function installStaticFlightFetch(): void {
  // DESIGN-GAP: A hybrid Next app cannot enable output:export globally; only public Flight GETs use its separate-file convention, while dynamic routes retain Next's normal protocol.
  const fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = staticActionUrl(input, init) ?? staticFlightUrl(input, init);
    if (!url) return fetch(input, init);
    const response = await fetch(input instanceof Request ? new Request(url, input) : url, init);
    // DESIGN-GAP: Next uses Response.url for build-skew/full-document fallback; retain the original page URL instead of navigating users to a raw Flight file or action prefix.
    Object.defineProperty(response, 'url', {
      value: new URL(input instanceof Request ? input.url : String(input), location.href).href,
    });
    return response;
  };
}
