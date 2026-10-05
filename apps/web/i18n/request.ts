import { getRequestConfig } from 'next-intl/server';
import { brand } from '@tianji/shared/brand';
import { routing, isLocale } from './routing';
import { toMessages } from './catalog';
import zh from '../messages/zh.json';
import tw from '../messages/zh-TW.json';
import twGlossary from '../messages/zh-TW/glossary.json';
import twInterpretation from '../messages/zh-TW/interpretation.json';
import en from '../messages/en.json';
import zhGlossary from '../messages/zh/glossary.json';
import enGlossary from '../messages/en/glossary.json';
import zhInterpretation from '../messages/zh/interpretation.json';
import enInterpretation from '../messages/en/interpretation.json';
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;
  const catalog =
    locale === 'zh-TW'
      ? { ...tw, ...twGlossary, ...twInterpretation }
      : locale !== 'en'
        ? { ...zh, ...zhGlossary, ...zhInterpretation }
        : { ...en, ...enGlossary, ...enInterpretation };
  return {
    locale,
    timeZone: 'UTC',
    messages: toMessages({
      ...catalog,
      ...Object.fromEntries(
        Object.entries(locale === 'zh-TW' ? twGlossary : zhGlossary)
          .filter(([key]) => key.endsWith('.term'))
          .map(([key, value]) => [
            key.replace(/\.term$/, '.bilingual'),
            `${value} · ${enGlossary[key as keyof typeof enGlossary]}`,
          ]),
      ),
      'brand.tagline': brand.tagline[locale],
    }),
  };
});
