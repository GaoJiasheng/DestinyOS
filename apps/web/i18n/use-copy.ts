'use client';
import { localizedValues } from './localized-values';
import { useLocale, useTranslations } from 'next-intl';
import type { MessageKey } from './catalog';
import { runtimeKey } from './runtime-key';
/** Translate exact documented keys via next-intl; values use ICU variables. */
export function useCopy() {
  const t = useTranslations();
  const locale = useLocale();
  return (key: MessageKey, values?: Record<string, string | number | Date>) =>
    t(runtimeKey(key), localizedValues(key, values, locale));
}
