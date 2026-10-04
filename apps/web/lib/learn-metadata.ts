import type { Metadata } from 'next';
import { brand } from '@tianji/shared';
/** Canonical and both locale alternates target the same specific encyclopedia article. */
export function learnMetadata(
  title: string,
  description: string,
  path: string,
  locale: 'zh' | 'en',
): Metadata {
  return {
    title,
    description,
    metadataBase: new URL(`https://${brand.domain}`),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { zh: `/zh${path}`, en: `/en${path}` },
    },
    openGraph: { type: 'article', title, description, locale },
    robots: { index: true, follow: true },
  };
}
