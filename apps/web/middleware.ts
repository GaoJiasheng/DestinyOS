import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
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
  return intl(request);
}
export const config = { matcher: ['/((?!api|admin|s/|_next|_vercel|.*\\..*).*)'] };
