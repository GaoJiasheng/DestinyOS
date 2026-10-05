import type { Metadata } from 'next';
import { brand } from '@tianji/shared';
/** Canonical and both locale alternates target the same specific encyclopedia article. */
export function learnMetadata(
  title: string,
  description: string,
  path: string,
  locale: 'zh' | 'en' | 'zh-TW',
): Metadata {
  return {
    title,
    description,
    metadataBase: new URL(`https://${brand.domain}`),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { zh: `/zh${path}`, 'zh-TW': `/zh-TW${path}`, en: `/en${path}` },
    },
    openGraph: {
      type: 'article',
      title,
      description,
      locale: locale === 'zh-TW' ? 'zh_TW' : locale,
      alternateLocale: ['zh', 'zh_TW', 'en'].filter(
        (value) => value !== (locale === 'zh-TW' ? 'zh_TW' : locale),
      ),
    },
    robots: { index: true, follow: true },
  };
}
