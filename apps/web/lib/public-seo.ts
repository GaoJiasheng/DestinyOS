import { isLocale } from '@/i18n/routing';
import { brand, type Locale } from '@tianji/shared';
import { cache } from 'react';
import { getCopy } from '@/i18n/get-copy';
import { learnContent } from './learn';
import { publicMetadata } from './learn-metadata';

/** Resolve only public, language-independent paths; no request text or private report data enters OG rendering. */
export const publicPageCatalog = cache(async (locale: Locale) => {
  const t = await getCopy(locale);
  const c = await learnContent(locale);
  const language = locale === 'en' ? 'en' : 'zh';
  const pages = new Map<string, { title: string; description: string }>();
  pages.set('', {
    title: t('common.brandTitle', { nameZh: brand.nameZh, nameEn: brand.nameEn }),
    description: t('brand.tagline'),
  });
  pages.set('/learn', { title: t('learn.title'), description: t('learn.intro') });
  pages.set('/learn/glossary', {
    title: t('learn.glossary'),
    description: t('learn.glossaryIntro'),
  });
  pages.set('/faq', { title: t('learn.faq'), description: t('learn.faqIntro') });
  pages.set('/about', {
    title: c.editorial.about[language].title,
    description: c.editorial.about[language].description,
  });
  pages.set('/pricing', { title: t('billing.title'), description: t('billing.proFeatures') });
  pages.set('/credits', {
    title: t('legal.attributions'),
    description: t('seo.credits.description'),
  });
  for (const path of ['privacy', 'terms', 'disclaimer', 'contact'] as const)
    pages.set(`/${path}`, { title: t(`legal.${path}`), description: t(`seo.${path}.description`) });
  for (const system of c.systems) {
    const data = { title: system[language].title, description: system[language].principle };
    pages.set(`/learn/${system.key}`, data);
    if (system.key !== 'synastry') pages.set(`/${system.key}`, data);
  }
  for (const article of c.articles)
    pages.set(`/learn/${article.system}/articles/${article.slug}`, article[language]);
  for (const card of c.cards)
    pages.set(`/learn/tarot/${card.key}`, {
      title: card.name[language],
      description: card.keywordsUpright[language].join(' · '),
    });
  for (const hexagram of c.hexagrams)
    pages.set(`/learn/iching/${hexagram.key}`, {
      title: language === 'en' ? hexagram.englishName : hexagram.name,
      description: hexagram.meaning[language].slice(0, 160),
    });
  for (const entry of c.glossary)
    pages.set(`/learn/glossary/${entry.key}`, {
      title: entry[language].term,
      description: entry[language].short,
    });
  return pages;
});

/** Resolve title and description from trusted catalogs for existing public destinations. */
export async function metadataForPublicPath(locale: Locale, path: string) {
  const page = (await publicPageCatalog(locale)).get(path);
  return page
    ? publicMetadata(page.title, page.description, path, locale)
    : { robots: { index: false, follow: false } };
}

/** Adapt route params without accepting unsupported locale segments. */
export async function publicRouteMetadata(params: Promise<{ locale: string }>, path: string) {
  const { locale } = await params;
  return isLocale(locale)
    ? metadataForPublicPath(locale, path)
    : { robots: { index: false, follow: false } };
}
