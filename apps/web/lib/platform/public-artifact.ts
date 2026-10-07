import registry from '../../.open-next/public-artifacts.json' with { type: 'json' };
import { securityHeaders, reportOnlyCsp } from '../security-headers';
import { publicCacheControl } from './public-cache';
const routes: Readonly<Record<string, { html: string; rsc: string }>> = registry;
/** Deliver full static Flight snapshots; partial router state never changes this public content. */
export async function publicArtifact(
  request: Request,
  assets: { fetch(request: Request): Promise<Response> },
): Promise<Response | null> {
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    request.headers.has('next-action') ||
    request.headers.has('authorization') ||
    request.headers.has('range') ||
    request.headers.has('x-prerender-revalidate') ||
    request.headers.has('x-isr') ||
    request.headers.has('next-router-segment-prefetch')
  )
    return null;
  const route = routes[url.pathname];
  if (!route) return null;
  // DESIGN-GAP: Static public pages contain no session data. Authenticated callers may read them, but workerFetch never stores their responses.
  const rsc = request.headers.get('rsc') === '1';
  const response = await assets.fetch(
    new Request(new URL(rsc ? route.rsc : route.html, request.url)),
  );
  if (!response.ok) return null;
  const headers = new Headers(
    securityHeaders().map(({ key, value }): [string, string] => [key, value]),
  );
  headers.set('Content-Type', rsc ? 'text/x-component' : 'text/html; charset=utf-8');
  headers.set(
    'Vary',
    'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url, Accept-Encoding',
  );
  headers.set(
    'Cache-Control',
    /(?:authjs|next-auth)\.[^=]*session-token(?:\.\d+)?=/.test(request.headers.get('cookie') ?? '')
      ? 'private, no-store'
      : publicCacheControl,
  );
  headers.set('Content-Security-Policy-Report-Only', reportOnlyCsp(btoa(crypto.randomUUID())));
  headers.set('X-Destiny-Renderer', 'artifact');
  return new Response(response.body, { headers });
}
