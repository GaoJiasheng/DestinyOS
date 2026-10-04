import { getTranslations } from 'next-intl/server';
import { runtimeKey, type MessageKey } from './catalog';
/** Obtain a server translator using exact documented keys and ICU variables. */
export async function getCopy() {
  const t = await getTranslations();
  return (key: MessageKey, values?: Record<string, string | number | Date>) =>
    t(runtimeKey(key), values);
}
