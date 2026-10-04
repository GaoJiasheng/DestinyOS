'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCopy } from '@/i18n/use-copy';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { acknowledgeDisclaimerAction, getDisclaimerAcknowledgementAction } from '@/app/me/actions';
/** Require an explicit first-visit acknowledgement; remember it when storage is available. */
export function Disclaimer() {
  const [open, setOpen] = useState(false);
  const t = useCopy();
  const pathname = usePathname();
  useEffect(() => {
    try {
      if (localStorage.getItem('tianji-disclaimer-v1') === 'accepted') {
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
  function acknowledge() {
    try {
      localStorage.setItem('tianji-disclaimer-v1', 'accepted');
    } catch {
      /* Keep this visit usable if storage is blocked. */
    }
    void acknowledgeDisclaimerAction().catch(() => undefined);
    setOpen(false);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={() => {}}
      required
      title={t('legal.firstVisit.title')}
      description={t('legal.disclaimer.full')}
    >
      <p className="type-small muted">{t('legal.ageConfirmation')}</p>
      <Button className="disclaimer-confirm" onClick={acknowledge}>
        {t('legal.firstVisit.confirm')}
      </Button>
    </Dialog>
  );
}
