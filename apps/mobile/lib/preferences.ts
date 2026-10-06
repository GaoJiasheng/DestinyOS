import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { i18n, type MobileLocale } from './i18n';
import type { Theme } from '@tianji/ui-core/tokens';
export type ThemePreference = 'auto' | Exclude<Theme, 'neutral'>;
interface Preferences {
  theme: ThemePreference;
  locale: MobileLocale;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: MobileLocale) => void;
}
// DESIGN-GAP: Only non-sensitive theme/language preferences use AsyncStorage; M04 owns encrypted data.
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
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) void i18n.changeLanguage(state.locale);
      },
    },
  ),
);
