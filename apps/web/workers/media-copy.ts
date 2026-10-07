import { createTranslator } from 'next-intl';
import { brand, type Locale } from '@tianji/shared';
import { toMessages, runtimeKey } from '../i18n/catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
import tw from '../messages/zh-TW.json';
import { resourceText } from './media-context';
const catalogs = new Map<Locale, ReturnType<typeof createTranslator>>();
/** Media uses next-intl with its own immutable catalog, without a Next server/request context. */
export async function shareCopy(locale: Locale) {
  let translator = catalogs.get(locale);
  if (!translator) {
    const [glossary, tarot] = await Promise.all([
      resourceText(`messages/${locale}/glossary.json`),
      resourceText(`messages/${locale}/tarot.json`),
    ]);
    translator = createTranslator({
      locale,
      messages: toMessages({
        ...(locale === 'en' ? en : locale === 'zh-TW' ? tw : zh),
        ...(JSON.parse(glossary) as Record<string, string>),
        ...(JSON.parse(tarot) as Record<string, string>),
        'brand.tagline': brand.tagline[locale],
      }),
    });
    catalogs.set(locale, translator);
  }
  const translate = translator;
  return (key: string, values?: Record<string, string | number>) =>
    translate(runtimeKey(key), values);
}
export { shareCopy as getCopy };
