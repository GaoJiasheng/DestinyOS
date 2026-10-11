'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import type { SiteSettings as Settings } from '@/lib/site-config-schema';
import { getPublicSiteSettingsAction } from '@/app/home/actions';
import { SiteNotice } from './site-notice';
import { SiteMaintenance } from './site-maintenance';
/** Hydrate mutable notices independently from cached public documents. */
export function SiteSettings({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const [settings, setSettings] = useState<Pick<Settings, 'announcement' | 'maintenance'> | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    const refresh = () => {
      void getPublicSiteSettingsAction(locale)
        .then((value) => {
          if (live) setSettings(value);
        })
        .catch(() => undefined);
    };
    refresh();
    // DESIGN-GAP: Public announcements and manual maintenance refresh every minute without invalidating or personalizing the HTML cache.
    const timer = setInterval(refresh, 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [locale]);
  return (
    <>
      {settings ? (
        <SiteNotice
          announcement={{
            ...settings.announcement,
            zh: settings.announcement.zh,
          }}
        />
      ) : null}
      <SiteMaintenance enabled={settings?.maintenance ?? false}>{children}</SiteMaintenance>
    </>
  );
}
