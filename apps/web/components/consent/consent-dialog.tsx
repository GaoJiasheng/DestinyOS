'use client';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useCopy } from '@/i18n/use-copy';
import { confirmConsent, declineConsent } from '@/lib/consent';
/** First-use age and disclaimer confirmation, opened in place by the gated action. */
export function ConsentDialog() {
  const t = useCopy();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) declineConsent();
      }}
      title={t('legal.firstVisit.title')}
      description={t('legal.disclaimer.full')}
    >
      <p className="type-small muted">{t('legal.ageConfirmation')}</p>
      <div className="dialog-actions">
        <Button onClick={confirmConsent}>{t('legal.consent.confirm')}</Button>
        <Button variant="ghost" onClick={declineConsent}>
          {t('legal.consent.cancel')}
        </Button>
      </div>
    </Dialog>
  );
}
