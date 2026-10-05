'use client';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { useCopy } from '@/i18n/use-copy';
import { usePathname } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { useState } from 'react';
/** Switch locale without losing the current route, query parameters, or fragment. */
export function LocaleSwitch() {
  const locale = useLocale();
  const t = useCopy();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  return (
    <label className="select-control">
      <Languages size={16} aria-hidden />
      <span className="sr-only">{t('nav.language')}</span>
      <select
        aria-label={t('nav.language')}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) {
            // DESIGN-GAP: Locale changes cross root html documents; a full navigation keeps Next.js streamed canonical metadata synchronized.
            setPending(true);
            document.cookie = `NEXT_LOCALE=${next}; Path=/; SameSite=Lax; Max-Age=31536000`;
            window.location.replace(
              `/${next}${pathname === '/' ? '' : pathname}${window.location.search}${window.location.hash}`,
            );
          }
        }}
      >
        <option value="zh">{t('nav.locale.zh')}</option>
        <option value="zh-TW">{t('nav.locale.zh-TW')}</option>
        <option value="en">{t('nav.locale.en')}</option>
      </select>
    </label>
  );
}
