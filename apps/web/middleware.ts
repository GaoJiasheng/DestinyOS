import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { reportOnlyCsp } from './lib/security-headers';
const intl = createMiddleware(routing);
/** A session age gate blocks returning to input routes; server actions independently enforce the same cookie. */
export default function middleware(request: NextRequest) {
  if (
    request.cookies.get('age_gate')?.value === 'blocked' &&
    /\/(new|me\/birth)\/?$/.test(request.nextUrl.pathname)
  ) {
    const locale = request.nextUrl.pathname.startsWith('/en') ? 'en' : 'zh';
    return NextResponse.redirect(new URL(`/${locale}/age-restricted`, request.url));
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = reportOnlyCsp(nonce);
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', csp);
  const excluded =
    /^\/(api|admin|s)(?:\/|$)/.test(request.nextUrl.pathname) ||
    /\.[^/]+$/.test(request.nextUrl.pathname);
  const response = excluded
    ? NextResponse.next({ request: { headers: request.headers } })
    : intl(request);
  // DESIGN-GAP: Static marketing pages retain static generation during the Report-Only rollout; enforcement requires auditing their inline scripts first.
  response.headers.set('Content-Security-Policy-Report-Only', csp);
  // Reject off-origin locale redirects even if localePrefix behavior changes in a future next-intl release.
  const location = response.headers.get('location');
  if (location && new URL(location, request.url).origin !== request.nextUrl.origin)
    return NextResponse.redirect(new URL('/zh', request.url));
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|_vercel|favicon.ico).*)'] };
