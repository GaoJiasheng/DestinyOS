'use client';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useCopy } from '@/i18n/use-copy';
import type { SiteSettings } from '@/lib/site-config-schema';
/** Render scoped bilingual announcements; server layout handles maintenance separately. */
export function SiteNotice({ announcement }: { announcement: SiteSettings['announcement'] }) {
  const t = useCopy(),
    pathname = usePathname().replace(/^\/(zh-TW|zh|en)(?=\/|$)/, '') || '/',
    locale = useLocale() === 'en' ? 'en' : 'zh';
  const now = Date.now();
  const scoped = announcement.scope.some(
    (scope) => scope === '/' || pathname === scope || pathname.startsWith(`${scope}/`),
  );
  if (
    !announcement[locale] ||
    !scoped ||
    (announcement.startsAt && Date.parse(announcement.startsAt) > now) ||
    (announcement.endsAt && Date.parse(announcement.endsAt) < now)
  )
    return null;
  return (
    <aside className="site-notice" role="status">
      {t('admin.content', { text: announcement[locale] })}
    </aside>
  );
}
