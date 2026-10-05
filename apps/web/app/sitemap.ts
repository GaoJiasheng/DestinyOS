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
    '/learn/glossary',
    '/faq',
    '/pricing',
    '/about',
    '/privacy',
    '/terms',
    '/disclaimer',
    '/contact',
    '/credits',
    // DESIGN-GAP: Existing qimen and synastry entry forms are noindex; their public learning pages remain included.
    ...c.systems.filter((s) => !['synastry', 'qimen'].includes(s.key)).map((s) => `/${s.key}`),
    ...c.systems.map((s) => `/learn/${s.key}`),
    ...c.articles.map((article) => `/learn/${article.system}/articles/${article.slug}`),
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
