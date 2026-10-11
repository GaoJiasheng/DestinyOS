import type { Locale } from '@tianji/shared';
import { platform } from './platform/environment';
import { publicPageCatalog } from './public-seo';
import { mediaRequest } from './platform/media-client';
/** Validate public metadata before dispatching renderer work to its service. */
export async function renderPublicOg(locale: Locale, path: string): Promise<Response | null> {
  if (platform() !== 'cloudflare')
    return (await import('./public-og-render')).renderPublicOg(locale, path);
  const page = (await publicPageCatalog(locale)).get(path);
  return page
    ? mediaRequest('/public-og', {
        locale,
        path,
        page: { title: page.title, description: page.description },
      })
    : null;
}
