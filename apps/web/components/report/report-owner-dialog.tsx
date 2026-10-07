'use client';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
/** Rename/delete confirmation UI; the owner action remains in the report controller. */
export function ReportOwnerDialog({
  dialog,
  setDialog,
  title,
  setTitle,
  busy,
  confirm,
}: {
  dialog: 'rename' | 'delete' | null;
  setDialog: (value: 'rename' | 'delete' | null) => void;
  title: string;
  setTitle: (value: string) => void;
  busy: boolean;
  confirm: () => Promise<void>;
}) {
  const t = useCopy();
  return (
    <Dialog
      open={dialog !== null}
      onOpenChange={(open) => {
        if (!open) setDialog(null);
      }}
      title={t(dialog === 'delete' ? 'report.delete' : 'report.rename')}
      description={t(dialog === 'delete' ? 'report.deleteConfirm' : 'report.renameHint')}
    >
      {dialog === 'rename' ? (
        <label className="birth-field">
          {t('report.rename')}
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
      ) : null}
      <div className="hero-actions">
        <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
          {t('report.cancel')}
        </Button>
        <Button disabled={busy || (dialog === 'rename' && !title.trim())} action={confirm}>
          {t('report.confirm')}
        </Button>
      </div>
    </Dialog>
  );
}
