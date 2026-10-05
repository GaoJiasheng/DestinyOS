import type { Metadata } from 'next';
import { brand, type Locale } from '@tianji/shared';
/** Common metadata for public pages, with exact path alternates and a localized 1200×630 OG template. */
export function publicMetadata(
  title: string,
  description: string,
  path: string,
  locale: Locale,
  type: 'article' | 'website' = 'website',
): Metadata {
  const image = `/api/og/public?${new URLSearchParams({ locale, path })}`;
  // DESIGN-GAP: Open Graph uses language_TERRITORY tags; route locales and hreflang retain the documented BCP 47 values.
  const ogLocales = { zh: 'zh_CN', 'zh-TW': 'zh_TW', en: 'en_US' } as const;
  return {
    title,
    description,
    metadataBase: new URL(`https://${brand.domain}`),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { zh: `/zh${path}`, 'zh-TW': `/zh-TW${path}`, en: `/en${path}` },
    },
    openGraph: {
      type,
      title,
      description,
      url: `/${locale}${path}`,
      locale: ogLocales[locale],
      alternateLocale: Object.values(ogLocales).filter((value) => value !== ogLocales[locale]),
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    robots: { index: true, follow: true },
  };
}
/** Encyclopedia Article metadata shares the public template and precise three-language alternates. */
export function learnMetadata(
  title: string,
  description: string,
  path: string,
  locale: Locale,
): Metadata {
  return publicMetadata(title, description, path, locale, 'article');
}
