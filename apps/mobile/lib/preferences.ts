import { NativeModules, Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { i18n, type MobileLocale } from './i18n';
import type { Theme } from '@tianji/ui-core/tokens';
import { encryptedPreferencesStorage } from './data/preferences-storage';
export type ThemePreference = 'auto' | Exclude<Theme, 'neutral'>;
interface Preferences {
  theme: ThemePreference;
  locale: MobileLocale;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: MobileLocale) => void;
}
/** Map a BCP 47 tag to a catalog: Traditional script or TW/HK/MO regions, other Chinese, else English. */
export function localeFromTag(tag: string | undefined): MobileLocale {
  const value = (tag ?? '').replace('_', '-').toLowerCase();
  if (!value.startsWith('zh')) return 'en';
  return /^zh-(hant|tw|hk|mo)\b/.test(value) ? 'zh-TW' : 'zh';
}
/** First-launch locale from the OS language; a saved choice always wins on rehydration. */
// DESIGN-GAP: expo-localization is not installed; read the platform locale modules, then Hermes Intl.
export function deviceLocale(): MobileLocale {
  try {
    const ios = NativeModules.SettingsManager as
      { settings?: { AppleLanguages?: string[]; AppleLocale?: string } } | undefined;
    const android = NativeModules.I18nManager as { localeIdentifier?: string } | undefined;
    const tag =
      Platform.OS === 'ios'
        ? (ios?.settings?.AppleLanguages?.[0] ?? ios?.settings?.AppleLocale)
        : android?.localeIdentifier;
    return localeFromTag(tag ?? Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'zh';
  }
}
const initialLocale = deviceLocale();
if (initialLocale !== 'zh') void i18n.changeLanguage(initialLocale);
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: 'auto',
      locale: initialLocale,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
    }),
    {
      name: 'tianji-ui-preferences',
      storage: createJSONStorage(() => encryptedPreferencesStorage),
      onRehydrateStorage: () => (state) => {
        if (state) void i18n.changeLanguage(state.locale);
      },
    },
  ),
);
