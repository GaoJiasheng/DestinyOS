import { themeColors, designTokens, points } from '@tianji/ui-core/tokens';
import { usePreferences } from './preferences';
/** Resolve the neutral tab shell or the user's locked east, west or vedic palette. */
export function useTheme() {
  const theme = usePreferences((state) => state.theme);
  const locale = usePreferences((state) => state.locale);
  return {
    colors: themeColors(theme === 'auto' ? 'neutral' : theme),
    heading:
      locale === 'en'
        ? theme === 'west' || theme === 'vedic'
          ? 'Cinzel'
          : 'Cormorant'
        : theme === 'west' || theme === 'vedic'
          ? 'Noto'
          : 'WenKai',
    body: locale === 'en' ? 'Inter' : 'Noto',
  };
}
export const space = Object.fromEntries(
  Object.entries(designTokens.spacing).map(([key, value]) => [key, points(value)]),
);
export const radius = points(designTokens.radii['r-lg']);
