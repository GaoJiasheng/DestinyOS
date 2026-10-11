import type { Locale } from '@tianji/shared';
import { publicPageCatalog } from './public-seo';
import { renderPublicOgTemplate } from './public-og-template';
/** Resolve registered page metadata before local rendering. */
export async function renderPublicOg(locale: Locale, path: string) {
  const page = (await publicPageCatalog(locale)).get(path);
  return page ? renderPublicOgTemplate(locale, path, page) : null;
}
