'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Link } from '@/i18n/navigation';
import { Button } from './ui/button';
import { acknowledgeDisclaimerAction, getDisclaimerAcknowledgementAction } from '@/app/me/actions';
/** Non-blocking first-visit notice: never gates content or takes focus; remembered like the former dialog. */
export function Disclaimer() {
  const [open, setOpen] = useState(false);
  const t = useCopy();
  const pathname = usePathname();
  useEffect(() => {
    try {
      if (localStorage.getItem('tianji-disclaimer-v1') === 'accepted') {
        setOpen(false);
        void acknowledgeDisclaimerAction().catch(() => undefined);
        return;
      }
      void getDisclaimerAcknowledgementAction()
        .then((accepted) => {
          setOpen(!accepted);
          if (accepted) localStorage.setItem('tianji-disclaimer-v1', 'accepted');
        })
        .catch(() => setOpen(true));
    } catch {
      setOpen(true);
    }
  }, [pathname]);
  async function acknowledge() {
    try {
      localStorage.setItem('tianji-disclaimer-v1', 'accepted');
    } catch {
      /* Keep this visit usable if storage is blocked. */
    }
    setOpen(false);
    await acknowledgeDisclaimerAction().catch(() => undefined);
  }
  if (!open) return null;
  return (
    <aside className="disclaimer-bar" aria-label={t('legal.firstVisit.label')}>
      <p className="type-small">
        {t('legal.firstVisit.notice')}{' '}
        <Link prefetch={false} href="/disclaimer">
          {t('legal.firstVisit.more')}
        </Link>
      </p>
      <Button className="disclaimer-confirm" action={acknowledge}>
        {t('legal.firstVisit.confirm')}
      </Button>
    </aside>
  );
}
