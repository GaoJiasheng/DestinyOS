import { createTranslator } from 'next-intl';
import { usePreferences } from './preferences';
import zh from '../../web/messages/zh.json';
import en from '../../web/messages/en.json';
import tw from '../../web/messages/zh-TW.json';
type EffectCatalogKey = Extract<keyof typeof zh, `mobile.effects.${string}`>;
type EffectKey = EffectCatalogKey extends `mobile.effects.${infer Key}` ? Key : never;
export const planetKeys = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;
/** Native developer UI uses next-intl's platform-independent ICU translator and shared Web catalogs. */
export function useEffectsCopy() {
  const locale = usePreferences((s) => s.locale);
  const catalog = locale === 'en' ? en : locale === 'zh-TW' ? tw : zh;
  const messages = Object.fromEntries(
    Object.entries(catalog)
      .filter(([key]) => key.startsWith('mobile.effects.'))
      .map(([key, value]) => [key.slice('mobile.effects.'.length), value]),
  ) as Record<EffectKey, string>;
  const nativeMessages = {
    ...messages,
    planets: Object.fromEntries(
      planetKeys.map((key) => [key, catalog[`charts.planet.${key}` as keyof typeof catalog]]),
    ),
  };
  return createTranslator({ locale, messages: nativeMessages });
}
