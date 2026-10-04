'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { routeTheme, type ThemePreference } from '@/lib/themes';
import { useCopy } from '@/i18n/use-copy';
import { Palette } from 'lucide-react';
const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
}>({ preference: 'auto', setPreference: () => {} });
// DESIGN-GAP: Before User settings exist, persist theme locks locally; auto follows routes.
/** Apply route themes and locally persisted theme locks to the document. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setState] = useState<ThemePreference>('auto');
  const pathname = usePathname();
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tianji-theme');
      if (saved === 'east' || saved === 'west') setState(saved);
    } catch {
      /* Storage restrictions leave auto mode available. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = routeTheme(pathname, preference);
  }, [pathname, preference]);
  function setPreference(value: ThemePreference) {
    setState(value);
    try {
      localStorage.setItem('tianji-theme', value);
    } catch {
      /* The preference remains active for this visit. */
    }
  }
  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
  );
}
/** Select automatic routing or lock the documented east/west theme. */
export function ThemeSwitch() {
  const { preference, setPreference } = useContext(ThemeContext);
  const t = useCopy();
  return (
    <label className="select-control">
      <Palette size={16} aria-hidden />
      <span className="sr-only">{t('nav.theme')}</span>
      <select
        aria-label={t('nav.theme')}
        value={preference}
        onChange={(event) => {
          const value = event.target.value;
          if (value === 'auto' || value === 'east' || value === 'west') setPreference(value);
        }}
      >
        {(['auto', 'east', 'west'] as const).map((theme) => (
          <option key={theme} value={theme}>
            {t(`nav.theme.${theme}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
