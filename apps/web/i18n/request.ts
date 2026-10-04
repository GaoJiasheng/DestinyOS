import { getRequestConfig } from 'next-intl/server';
import { brand } from '@tianji/shared/brand';
import { routing, isLocale } from './routing';
import { toMessages } from './catalog';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;
  const catalog = locale === 'zh' ? zh : en;
  return {
    locale,
    timeZone: 'UTC',
    messages: toMessages({ ...catalog, 'brand.tagline': brand.tagline[locale] }),
  };
});
