'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCopy } from '@/i18n/use-copy';
/** Keep administrator provider confirmation reachable while public content is under maintenance. */
export function SiteMaintenance({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const t = useCopy();
  // DESIGN-GAP: Login and email confirmation bypass maintenance so administrators can complete re-authentication.
  if (!enabled || /^\/(zh|en)\/auth(?:\/|$)/.test(pathname)) return children;
  return (
    <section className="settings-page">
      <h1>{t('site.maintenance.title')}</h1>
      <p>{t('site.maintenance.description')}</p>
    </section>
  );
}
