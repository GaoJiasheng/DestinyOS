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
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: 'auto',
      locale: 'zh',
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
