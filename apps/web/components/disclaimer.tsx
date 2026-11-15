'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { Button } from './ui/button';
import { acknowledgeDisclaimerAction } from '@/app/me/actions';
import {
  dismissNotice,
  hasDeviceConsent,
  isNoticeDismissed,
  refreshAccountConsent,
  subscribeConsent,
} from '@/lib/consent';
/**
 * Non-blocking first-visit notice: never gates content or takes focus.
 * Dismissing it only hides it; age and disclaimer are confirmed at the first reading (see lib/consent).
 */
export function Disclaimer() {
  const [open, setOpen] = useState(false);
  const t = useCopy();
  const pathname = usePathname();
  useEffect(() => {
    if (hasDeviceConsent()) {
      setOpen(false);
      void acknowledgeDisclaimerAction().catch(() => undefined);
      return;
    }
    // DESIGN-GAP: Show the notice without waiting for the account lookup; an account that already confirmed closes it through the subscription below.
    setOpen(!isNoticeDismissed());
    void refreshAccountConsent();
  }, [pathname]);
  useEffect(
    () =>
      subscribeConsent(() => {
        if (hasDeviceConsent()) setOpen(false);
      }),
    [],
  );
  function dismiss() {
    dismissNotice();
    setOpen(false);
  }
  if (!open) return null;
  return (
    <aside className="disclaimer-bar" aria-label={t('legal.firstVisit.label')}>
      {/* DESIGN-GAP: Phones get a shorter notice so the bar stays within two lines; the full text is one tap away. */}
      <p className="type-small disclaimer-full">
        {t('legal.firstVisit.notice')}{' '}
        <Link prefetch={false} href="/disclaimer">
          {t('legal.firstVisit.more')}
        </Link>
      </p>
      <p className="type-small disclaimer-short">
        {t('legal.firstVisit.short')}{' '}
        <Link prefetch={false} href="/disclaimer">
          {t('legal.firstVisit.moreShort')}
        </Link>
      </p>
      <Button className="disclaimer-confirm" onClick={dismiss}>
        {t('legal.firstVisit.confirm')}
      </Button>
    </aside>
  );
}
