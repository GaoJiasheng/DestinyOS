import { membershipEnabled } from './lib/membership';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing, isLocale } from './i18n/routing';
import { reportOnlyCsp } from './lib/security-headers';
import learnPaths from './lib/learn-paths-generated.json' with { type: 'json' };
import { isKnownRoute } from './lib/known-routes';
const intl = createMiddleware(routing);
const learning = new Set<string>(learnPaths);
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
    // DESIGN-GAP: The independent share root needs the child token to retain its locale/theme; the nested layout guards availability before its loading boundary.
    request.headers.set('x-share-token', request.nextUrl.pathname.split('/')[2] ?? '');
  }
  request.headers.set('Content-Security-Policy', csp);
  if (
    !membershipEnabled() &&
    /^\/(?:zh|en|zh-TW)\/(?:pricing|me\/billing)\/?$/.test(request.nextUrl.pathname)
  ) {
    const locale = request.nextUrl.pathname.split('/')[1];
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }
  const localized = request.nextUrl.pathname.match(/^\/(zh|en|zh-TW)((?:\/.*)?)$/);
  const path = localized?.[2]!.replace(/\/$/, '') ?? '';
  // Paths with a file extension are static Flight/segment assets, never pages.
  const unknown =
    localized &&
    !/\.[^/]+$/.test(path) &&
    (/^\/learn(?:\/|$)/.test(path) ? !learning.has(path) : !isKnownRoute(path));
  if (localized && unknown) {
    // DESIGN-GAP: Reuse the existing localized not-found renderer; the middleware status stays 404 even when its layout streams a loading shell.
    const response = NextResponse.rewrite(new URL(`/${localized[1]}/404`, request.url), {
      status: 404,
      request: { headers: request.headers },
    });
    response.headers.set('Content-Security-Policy-Report-Only', csp);
    return response;
  }
  const excluded =
    // Workers Assets serve the offline shells before this runs; on Node the extensionless URL the service worker caches is rewritten in next.config.ts and must not be locale-redirected.
    /^\/(api|admin|s|offline|\.well-known)(?:\/|$)/.test(request.nextUrl.pathname) ||
    /^\/auth\/verify\/?$/.test(request.nextUrl.pathname) ||
    /^\/auth\/mobile\/(apple|google)$/.test(request.nextUrl.pathname) ||
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
