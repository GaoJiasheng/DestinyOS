import './intl';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import zh from '../../web/messages/zh.json';
import zhTW from '../../web/messages/zh-TW.json';
import en from '../../web/messages/en.json';
import zhTarot from '../../web/messages/zh/tarot.json';
import zhTWTarot from '../../web/messages/zh-TW/tarot.json';
import enTarot from '../../web/messages/en/tarot.json';

export const locales = ['zh', 'zh-TW', 'en'] as const;
export type MobileLocale = (typeof locales)[number];
const catalogs = {
  zh: { ...zh, ...zhTarot },
  'zh-TW': { ...zhTW, ...zhTWTarot },
  en: { ...en, ...enTarot },
};
export type MessageKey = keyof typeof catalogs.zh;
export const resources = {
  zh: { translation: catalogs.zh },
  'zh-TW': { translation: catalogs['zh-TW'] },
  en: { translation: catalogs.en },
};
export const i18n = createInstance();
// Retain i18next for existing diagnostic surfaces; M05 screens use next-intl over the same catalogs.
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
