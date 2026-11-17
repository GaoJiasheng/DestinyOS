'use client';
import { useEffect, useId, type ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { routeTheme, type ThemePreference } from '@/lib/themes';
import { createShellStore, useShellStore } from '@/lib/shell-store';
import { useCopy } from '@/i18n/use-copy';
import { Palette } from 'lucide-react';
const themePreference = createShellStore<ThemePreference>('auto');
function setPreference(value: ThemePreference) {
  themePreference.set(value);
  try {
    localStorage.setItem('tianji-theme', value);
  } catch {
    /* The preference remains active for this visit. */
  }
}
// DESIGN-GAP: Device preferences render immediately; authenticated settings synchronize after hydration.
/** Apply route themes and locally persisted theme locks to the document. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useShellStore(themePreference);
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.dataset.theme = routeTheme(pathname, preference);
  }, [pathname, preference]);
  useEffect(() => {
    const update = () => {
      try {
        const saved = localStorage.getItem('tianji-theme');
        themePreference.set(saved === 'east' || saved === 'west' ? saved : 'auto');
      } catch {
        /* Restricted storage leaves auto available. */
      }
    };
    update();
    window.addEventListener('tianji-settings', update);
    return () => window.removeEventListener('tianji-settings', update);
  }, []);
  return <>{children}</>;
}
/** Select automatic routing or lock the documented east/west theme. */
export function ThemeSwitch() {
  const preference = useShellStore(themePreference);
  const t = useCopy();
  const hint = useId();
  // The east/west names alone read like content filters; the hint says they are colour schemes.
  return (
    <label className="select-control" title={t('nav.theme.hint')}>
      <Palette size={16} aria-hidden />
      <span className="sr-only">{t('nav.theme')}</span>
      <span className="sr-only" id={hint}>
        {t('nav.theme.hint')}
      </span>
      <select
        aria-label={t('nav.theme')}
        aria-describedby={hint}
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
