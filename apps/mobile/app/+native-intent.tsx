/** Normalize documented locale-prefixed HTTPS email links to the native verification screen. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'https://tianji.gavin.pub');
    if (
      url.protocol === 'https:' &&
      url.hostname === 'tianji.gavin.pub' &&
      /^\/(?:zh\/|en\/|zh-TW\/)?auth\/verify\/?$/.test(url.pathname)
    )
      return `/auth/verify${url.search}`;
    // DESIGN-GAP: Browser authentication owns callback fragments; keep provider credentials out of Router history.
    if (url.protocol === 'tianji:' && url.host === 'auth' && url.pathname === '/callback')
      return '/auth/callback';
    return path;
  } catch {
    return '/auth/login';
  }
}
