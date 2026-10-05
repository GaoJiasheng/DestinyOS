import type { MetadataRoute } from 'next';
import { learnContent } from '@/lib/learn';
import { brand } from '@tianji/shared';
/** Include public routes only; tokens, reports and account pages never enter the sitemap. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await learnContent(),
    origin = `https://${brand.domain}`;
  const paths = [
    '',
    '/learn',
    '/pricing',
    '/about',
    '/privacy',
    '/terms',
    '/disclaimer',
    '/contact',
    ...c.systems.map((s) => `/${s.key}`),
    ...c.systems.map((s) => `/learn/${s.key}`),
    ...c.cards.map((s) => `/learn/tarot/${s.key}`),
    ...c.hexagrams.map((s) => `/learn/iching/${s.key}`),
    ...c.glossary.map((s) => `/learn/glossary/${s.key}`),
  ];
  return paths.flatMap((path) =>
    (['zh', 'zh-TW', 'en'] as const).map((locale) => ({
      url: `${origin}/${locale}${path}`,
      alternates: {
        languages: {
          zh: `${origin}/zh${path}`,
          'zh-TW': `${origin}/zh-TW${path}`,
          en: `${origin}/en${path}`,
        },
      },
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.6,
    })),
  );
}
