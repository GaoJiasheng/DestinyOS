import type { Metadata } from 'next';
import { brand } from '@tianji/shared/brand';
import { isLocale } from '@/i18n/routing';
import { getCopy } from '@/i18n/get-copy';
import type { MessageKey } from '@/i18n/catalog';
import { systems } from '@/lib/system-links';

type PageKey = Extract<MessageKey, `seo.page.${string}`>;
const noindex = { index: false, follow: false } as const;

/**
 * Localized "Page · 天机" / "Page · DestinyOS" titles for private and personalised screens.
 * They stay out of search indexes; only the tab title and history entries change.
 */
export async function privatePageMetadata(
  params: Promise<{ locale: string; system?: string }>,
  key: PageKey,
  { extra = {}, index = false }: { extra?: Metadata; index?: boolean } = {},
): Promise<Metadata> {
  // `index` keeps pages that never carried a robots rule (login, birth editor) exactly as they were.
  const robots = index ? {} : { robots: noindex };
  const { locale, system } = await params;
  if (!isLocale(locale)) return { ...extra, ...robots };
  const t = await getCopy(locale);
  const known = systems.find((value) => value === system);
  if (system !== undefined && !known) return { ...extra, ...robots };
  const page = t(key, known ? { system: t(`nav.${known}`) } : undefined);
  return {
    ...extra,
    title: t('common.pageTitle', {
      page,
      brand: locale === 'en' ? brand.nameEn : brand.nameZh,
    }),
    ...robots,
  };
}
