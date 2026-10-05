import type { Locale } from '@tianji/shared';
/** DESIGN-GAP: Prisma enum identifiers cannot contain hyphens; map the database value to BCP 47 at application boundaries. */
export function toDbLocale(locale: Locale): 'zh' | 'en' | 'zh_TW' {
  return locale === 'zh-TW' ? 'zh_TW' : locale;
}
/** Expose the documented BCP 47 locale to URLs and next-intl. */
export function fromDbLocale(locale: 'zh' | 'en' | 'zh_TW'): Locale {
  return locale === 'zh_TW' ? 'zh-TW' : locale;
}
