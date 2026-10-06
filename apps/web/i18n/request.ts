import { getRequestConfig } from 'next-intl/server';
import { brand } from '@tianji/shared/brand';
import { routing, isLocale } from './routing';
import { toMessages } from './catalog';
import { loadGlossary } from './glossary';
import zh from '../messages/zh.json';
import tw from '../messages/zh-TW.json';
import twInterpretation from '../messages/zh-TW/interpretation.json';
import en from '../messages/en.json';
import zhInterpretation from '../messages/zh/interpretation.json';
import enInterpretation from '../messages/en/interpretation.json';
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;
  const [glossary, zhGlossary, enGlossary] = await Promise.all([
    loadGlossary(locale),
    loadGlossary('zh'),
    loadGlossary('en'),
  ]);
  const catalog =
    locale === 'zh-TW'
      ? { ...tw, ...glossary, ...twInterpretation }
      : locale !== 'en'
        ? { ...zh, ...glossary, ...zhInterpretation }
        : { ...en, ...glossary, ...enInterpretation };
  return {
    locale,
    timeZone: 'UTC',
    messages: toMessages({
      ...catalog,
      ...Object.fromEntries(
        Object.entries(locale === 'zh-TW' ? glossary : zhGlossary)
          .filter(([key]) => key.endsWith('.term'))
          .map(([key, value]) => {
            const english = enGlossary[key];
            if (english === undefined) throw new Error('Missing bilingual glossary term');
            return [key.replace(/\.term$/, '.bilingual'), `${value} · ${english}`];
          }),
      ),
      'brand.tagline': brand.tagline[locale],
    }),
  };
});
