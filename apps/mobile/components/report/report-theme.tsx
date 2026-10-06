import type { ReactNode } from 'react';
import { ReportThemeContext } from '../../lib/theme';
import type { ReportSystem } from '../../lib/reports/readings';
/** Auto mode selects the documented report palette; an explicit user theme still takes precedence. */
export function ReportTheme({ system, children }: { system: ReportSystem; children: ReactNode }) {
  const theme =
    system === 'vedic'
      ? 'vedic'
      : ['tarot', 'astrology', 'synastry'].includes(system)
        ? 'west'
        : 'east';
  return <ReportThemeContext.Provider value={theme}>{children}</ReportThemeContext.Provider>;
}
