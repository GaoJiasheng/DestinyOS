'use client';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useCopy } from '@/i18n/use-copy';
import { readAnonymous, type AnonymousData } from '@/lib/anonymous-storage';
import { Button } from '@/components/ui/button';
import { ImportDialog } from './anonymous-import';
/** Signed-in reminder that device data is not in the account yet; "later" hides only the popup, never this. */
export function ImportBanner() {
  const t = useCopy();
  const router = useRouter();
  const [data, setData] = useState<AnonymousData | null>(null);
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    void readAnonymous()
      .then((stored) => {
        if (active) setData(stored && (stored.readings.length || stored.profile) ? stored : null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [version]);
  if (!data) return null;
  const count = data.readings.length;
  return (
    <aside className="notice import-banner" data-testid="import-banner">
      <p>
        {count && data.profile
          ? t('report.importFlow.bannerBoth', { count })
          : count
            ? t('report.importFlow.bannerReadings', { count })
            : t('report.importFlow.bannerProfile')}
      </p>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('report.importFlow.bannerAction')}
      </Button>
      <ImportDialog
        data={data}
        open={open}
        onOpenChange={setOpen}
        onFinished={() => {
          setVersion((v) => v + 1);
          router.refresh();
        }}
      />
    </aside>
  );
}
