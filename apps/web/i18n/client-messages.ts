import { systems } from '@/lib/system-links';
import type { AbstractIntlMessages } from 'next-intl';
// DESIGN-GAP: Serialize only shell namespaces; feature layouts own their complete catalogs, while server translations retain the full glossary.
const shellNamespaces = new Set([
  'brand',
  'common',
  'nav',
  'home',
  'pwa',
  'legal',
  'site',
  'profiles',
  'me',
  'report',
  'daily',
  'billing',
  'errors',
  'learn',
  'anon',
  'engine',
  // DESIGN-GAP: Artwork alt text belongs to the shared shell because first-visit and error illustrations render outside feature providers.
  'art',
]);
/** Keep private feature and encyclopedia text out of every public HTML response. */
export function shellMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const selected = Object.fromEntries(
    Object.entries(messages).filter(([key]) => shellNamespaces.has(key)),
  );
  const admin = messages.admin;
  if (admin && typeof admin === 'object' && admin.content)
    selected.admin = { content: admin.content };

  const bazi = messages.bazi;
  if (bazi && typeof bazi === 'object' && bazi.stems && bazi.branches)
    selected.bazi = { stems: bazi.stems, branches: bazi.branches };
  for (const system of systems) {
    const namespace = messages[system];
    if (namespace && typeof namespace === 'object' && namespace.placeholder) {
      const existing = selected[system];
      selected[system] = {
        ...(existing && typeof existing === 'object' ? existing : {}),
        placeholder: namespace.placeholder,
        ...(system === 'synastry' && namespace.requiresTwo
          ? { requiresTwo: namespace.requiresTwo }
          : {}),
      };
    }
  }
  return selected;
}
