import { describe, expect, it } from 'vitest';
import sitemap from '../app/sitemap';
import { publicMetadata, learnMetadata } from '../lib/learn-metadata';
import { learnContent } from '../lib/learn';
import { brand } from '@tianji/shared';

describe('public SEO coverage', () => {
  it('uses the same exact article path in all canonical, hreflang, and image destinations', () => {
    const path = '/learn/synastry/articles/comparison-basics';
    for (const locale of ['zh', 'zh-TW', 'en'] as const) {
      const meta = learnMetadata('Example title', 'Example description', path, locale);
      expect(meta.alternates).toEqual({
        canonical: `/${locale}${path}`,
        languages: { zh: `/zh${path}`, 'zh-TW': `/zh-TW${path}`, en: `/en${path}` },
      });
      expect(meta.twitter).toMatchObject({
        card: 'summary_large_image',
        images: [`/api/og/public?${new URLSearchParams({ locale, path })}`],
      });
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(meta.openGraph).toMatchObject({
        locale: locale === 'zh-TW' ? 'zh_TW' : locale === 'en' ? 'en_US' : 'zh_CN',
      });
    }
    expect(publicMetadata('FAQ', 'Questions', '/faq', 'en').openGraph).toMatchObject({
      type: 'website',
    });
  });

  it('includes every tutorial in all three languages and excludes private entry forms and reports', async () => {
    const entries = await sitemap();
    const content = await learnContent();
    const urls = new Set(entries.map((entry) => entry.url));
    expect(urls.size).toBe(entries.length);
    for (const article of content.articles)
      for (const locale of ['zh', 'zh-TW', 'en'])
        expect(
          urls.has(
            `https://${brand.domain}/${locale}/learn/${article.system}/articles/${article.slug}`,
          ),
        ).toBe(true);
    for (const locale of ['zh', 'zh-TW', 'en']) {
      expect(urls.has(`https://${brand.domain}/${locale}/faq`)).toBe(true);
      expect(urls.has(`https://${brand.domain}/${locale}/learn/glossary`)).toBe(true);
      expect(urls.has(`https://${brand.domain}/${locale}/synastry`)).toBe(false);
      expect(urls.has(`https://${brand.domain}/${locale}/qimen`)).toBe(false);
    }
    expect(entries.every((entry) => !/\/(me|s|auth)(\/|$)|\/r\//.test(entry.url))).toBe(true);
    expect(
      entries.every(
        (entry) =>
          Object.keys(entry.alternates?.languages ?? {})
            .sort()
            .join(',') === 'en,zh,zh-TW',
      ),
    ).toBe(true);
  });
});
