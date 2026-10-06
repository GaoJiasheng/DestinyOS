import { themeColors, designTokens, points } from '@tianji/ui-core/tokens';
import { usePreferences } from './preferences';
import { createContext, useContext } from 'react';
import type { Theme } from '@tianji/ui-core/tokens';
export const ReportThemeContext = createContext<Theme>('neutral');
/** Resolve the neutral tab shell or the user's locked east, west or vedic palette. */
export function useTheme() {
  const theme = usePreferences((state) => state.theme);
  const locale = usePreferences((state) => state.locale);
  const scope = useContext(ReportThemeContext);
  const resolved = theme === 'auto' ? scope : theme;
  return {
    colors: themeColors(resolved),
    heading:
      locale === 'en'
        ? resolved === 'west' || resolved === 'vedic'
          ? 'Cinzel'
          : 'Cormorant'
        : resolved === 'west' || resolved === 'vedic'
          ? 'Noto'
          : 'WenKai',
    body: locale === 'en' ? 'Inter' : 'Noto',
  };
}
export const space = Object.fromEntries(
  Object.entries(designTokens.spacing).map(([key, value]) => [key, points(value)]),
);
export const radius = points(designTokens.radii['r-lg']);
