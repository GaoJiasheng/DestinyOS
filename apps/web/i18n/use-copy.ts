'use client';
import { useTranslations } from 'next-intl';
import { runtimeKey, type MessageKey } from './catalog';
/** Translate exact documented keys via next-intl; values use ICU variables. */
export function useCopy() {
  const t = useTranslations();
  return (key: MessageKey, values?: Record<string, string | number | Date>) =>
    t(runtimeKey(key), values);
}
