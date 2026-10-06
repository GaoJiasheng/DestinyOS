import { z } from 'zod';
import { Locale } from '@tianji/shared';
/** SQLite TEXT stores the existing BCP 47 database values directly. */
export function toDbLocale(locale: Locale): Locale {
  return locale;
}
/** Validate stored locales at application boundaries. */
export function fromDbLocale(locale: string): Locale {
  return z.nativeEnum(Locale).parse(locale);
}
