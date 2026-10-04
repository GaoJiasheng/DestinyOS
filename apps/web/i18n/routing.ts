import { defineRouting } from 'next-intl/routing';
import { Locale } from '@tianji/shared/enums';
export const routing = defineRouting({
  locales: [Locale.zh, Locale.en],
  defaultLocale: Locale.zh,
  localePrefix: 'always',
  localeDetection: true,
  localeCookie: { name: 'NEXT_LOCALE', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 },
});
/** Validate a requested BCP 47 locale against the initial two supported languages. */
export function isLocale(value: string): value is Locale {
  return value === Locale.zh || value === Locale.en;
}
