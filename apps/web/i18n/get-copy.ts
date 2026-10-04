import { getTranslations } from 'next-intl/server';
import type { MessageKey } from './catalog';
import { runtimeKey } from './runtime-key';
/** Obtain a server translator using exact documented keys and ICU variables. */
export async function getCopy() {
  const t = await getTranslations();
  return (key: MessageKey, values?: Record<string, string | number | Date>) =>
    t(runtimeKey(key), values);
}
