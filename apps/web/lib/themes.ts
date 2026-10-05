export type Theme = 'neutral' | 'east' | 'west' | 'vedic';
export type ThemePreference = 'auto' | 'east' | 'west';
/** Route prefixes select a theme, unless the visitor has locked a preference. */
export function routeTheme(pathname: string, preference: ThemePreference = 'auto'): Theme {
  if (preference !== 'auto') return preference;
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  const system = first === 'zh' || first === 'zh-TW' || first === 'en' ? segments[1] : first;
  if (system && ['bazi', 'ziwei', 'iching', 'qimen'].includes(system)) return 'east';
  if (system && ['tarot', 'astrology', 'numerology'].includes(system)) return 'west';
  return system === 'vedic' ? 'vedic' : 'neutral';
}
