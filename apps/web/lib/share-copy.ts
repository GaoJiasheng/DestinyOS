import { createTranslator } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { toMessages, runtimeKey } from '@/i18n/catalog';
import type { Locale } from '@tianji/shared';

/** Public charts use the same scoped card catalog as owner reports, without exposing inputs. */
export async function shareCopy(locale: Locale) {
  const base = await getTranslations({ locale });
  const catalog =
    locale === 'en'
      ? (await import('@/messages/en/tarot.json')).default
      : (await import('@/messages/zh/tarot.json')).default;
  const tarot = createTranslator({ locale, messages: toMessages(catalog) });
  return (key: string, values?: Record<string, string | number>) =>
    key.startsWith('tarot.card.') ? tarot(key, values) : base(runtimeKey(key), values);
}
