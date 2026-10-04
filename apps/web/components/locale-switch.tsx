'use client';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { useCopy } from '@/i18n/use-copy';
import { usePathname, useRouter } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { useTransition } from 'react';
/** Switch locale without losing the current route, query parameters, or fragment. */
export function LocaleSwitch() {
  const locale = useLocale();
  const t = useCopy();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
          if (isLocale(next))
            startTransition(() =>
              router.replace(`${pathname}${window.location.search}${window.location.hash}`, {
                locale: next,
                scroll: false,
              }),
            );
        }}
      >
        <option value="zh">{t('nav.locale.zh')}</option>
        <option value="en">{t('nav.locale.en')}</option>
      </select>
    </label>
  );
}
