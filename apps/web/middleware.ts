import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing, isLocale } from './i18n/routing';
import { reportOnlyCsp } from './lib/security-headers';
const intl = createMiddleware(routing);
/** A session age gate blocks returning to input routes; server actions independently enforce the same cookie. */
export default function middleware(request: NextRequest) {
  if (
    request.cookies.get('age_gate')?.value === 'blocked' &&
    /\/(new|me\/birth)\/?$/.test(request.nextUrl.pathname)
  ) {
    const segment = request.nextUrl.pathname.split('/')[1] ?? '';
    const locale = isLocale(segment) ? segment : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/age-restricted`, request.url));
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = reportOnlyCsp(nonce, process.env.NODE_ENV === 'development');
  request.headers.set('x-nonce', nonce);
  if (/^\/admin(?:\/|$)/.test(request.nextUrl.pathname))
    request.headers.set(
      'x-next-intl-locale',
      request.cookies.get('admin_locale')?.value === 'en' ? 'en' : 'zh',
    );
  if (/^\/s\//.test(request.nextUrl.pathname)) {
    const locale = request.nextUrl.searchParams.get('locale');
    request.headers.set('x-share-locale', locale && isLocale(locale) ? locale : '');
  }
  request.headers.set('Content-Security-Policy', csp);
  const excluded =
    /^\/(api|admin|s)(?:\/|$)/.test(request.nextUrl.pathname) ||
    /\.[^/]+$/.test(request.nextUrl.pathname);
  const response = excluded
    ? NextResponse.next({ request: { headers: request.headers } })
    : intl(request);
  // DESIGN-GAP: Background prefetches from an old locale must not overwrite the language selected by a foreground navigation.
  if (request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch')
    response.headers.delete('set-cookie');
  // DESIGN-GAP: Static marketing pages retain static generation during the Report-Only rollout; enforcement requires auditing their inline scripts first.
  response.headers.set('Content-Security-Policy-Report-Only', csp);
  // Reject off-origin locale redirects even if localePrefix behavior changes in a future next-intl release.
  const location = response.headers.get('location');
  if (location && new URL(location, request.url).origin !== request.nextUrl.origin)
    return NextResponse.redirect(new URL('/zh', request.url));
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|_vercel|favicon.ico).*)'] };
