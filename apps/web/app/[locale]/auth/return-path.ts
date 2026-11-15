import { isLocale } from '@/i18n/routing';

/** Cookie that carries the post-login destination across the magic-link round trip. */
export const returnCookie = 'tianji-return-to';
const base = 'http://return.invalid';

/**
 * Accept only same-origin relative paths ("/x", never "//x" or "/\x"); anything else returns the
 * locale home. Paths without a locale prefix (e.g. "/me/billing") are placed under `locale`, and
 * auth screens fall back home so a successful login never lands back on the login form.
 */
export function safeReturnPath(raw: unknown, locale: string): string {
  const fallbackLocale = isLocale(locale) ? locale : 'zh';
  const home = `/${fallbackLocale}`;
  if (typeof raw !== 'string' || raw.length > 512) return home;
  // Backslashes and control characters are normalised by browsers into protocol-relative URLs.
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    [...raw].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)
  )
    return home;
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return home;
  }
  if (url.origin !== base) return home;
  const segments = url.pathname.split('/');
  const first = segments[1] ?? '';
  const path = isLocale(first)
    ? url.pathname
    : /^\/admin(?:\/|$)/.test(url.pathname)
      ? url.pathname
      : `${home}${url.pathname === '/' ? '' : url.pathname}`;
  const rest = isLocale(first) ? `/${segments.slice(2).join('/')}` : url.pathname;
  if (/^\/auth(?:\/|$)/.test(rest)) return home;
  return `${path}${url.search}${url.hash}`;
}
