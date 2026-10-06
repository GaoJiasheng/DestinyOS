import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import zh from '../../web/messages/zh.json';
import zhTW from '../../web/messages/zh-TW.json';
import en from '../../web/messages/en.json';

export const locales = ['zh', 'zh-TW', 'en'] as const;
export type MobileLocale = (typeof locales)[number];
export type MessageKey = keyof typeof zh;
export const resources = {
  zh: { translation: zh },
  'zh-TW': { translation: zhTW },
  en: { translation: en },
};
export const i18n = createInstance();
// App plan §2.2 overrides next-intl for native; catalogs and ICU messages are shared verbatim.
void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',
    fallbackLng: 'zh',
    supportedLngs: locales,
    keySeparator: false,
    initImmediate: false,
    interpolation: { escapeValue: false },
  });
