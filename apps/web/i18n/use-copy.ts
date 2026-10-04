'use client';
import { useTranslations } from 'next-intl';
import type { MessageKey } from './catalog';
import { runtimeKey } from './runtime-key';
/** Translate exact documented keys via next-intl; values use ICU variables. */
export function useCopy() {
  const t = useTranslations();
  return (key: MessageKey, values?: Record<string, string | number | Date>) =>
    t(runtimeKey(key), values);
}
