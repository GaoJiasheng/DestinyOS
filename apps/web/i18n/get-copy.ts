import { localizedValues } from './localized-values';
import { getLocale, getTranslations } from 'next-intl/server';
import type { MessageKey } from './catalog';
import { runtimeKey } from './runtime-key';
/** Obtain a server translator using exact documented keys and ICU variables. */
export async function getCopy(locale?: 'zh' | 'en' | 'zh-TW') {
  const language = locale ?? (await getLocale());
  const t = locale ? await getTranslations({ locale }) : await getTranslations();
  return (key: MessageKey, values?: Record<string, string | number | Date>) =>
    t(runtimeKey(key), localizedValues(key, values, language));
}
