'use client';
import { useEffect, useState } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
// DESIGN-GAP: Version the acknowledgement locally; account persistence awaits authentication.
/** Require an explicit first-visit acknowledgement; remember it when storage is available. */
export function Disclaimer() {
  const [open, setOpen] = useState(false);
  const t = useCopy();
  useEffect(() => {
    try {
      setOpen(localStorage.getItem('tianji-disclaimer-v1') !== 'accepted');
    } catch {
      setOpen(true);
    }
  }, []);
  function acknowledge() {
    try {
      localStorage.setItem('tianji-disclaimer-v1', 'accepted');
    } catch {
      /* Keep this visit usable if storage is blocked. */
    }
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
