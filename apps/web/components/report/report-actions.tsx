'use client';
import { Ellipsis, Table2 } from 'lucide-react';
import type { System } from '@tianji/shared';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/share/share-dialog';
import { ExportMenu } from './export-menu';

/** Toolbar of same-size outlined icon buttons; the row scrolls instead of wrapping on narrow screens. */
export function ReportActions({
  system,
  readingId,
  local,
  owner,
  professional,
  onProfessional,
  busy,
  onRename,
  onRegenerate,
  onDelete,
}: {
  system: System;
  readingId: string;
  local: boolean;
  owner: boolean;
  professional: boolean;
  onProfessional: () => void;
  busy: boolean;
  onRename: () => void;
  onRegenerate: () => Promise<void>;
  onDelete: () => void;
}) {
  const t = useCopy();
  return (
    <div className="report-actions">
      <Button
        variant="secondary"
        className="report-action"
        aria-pressed={professional}
        onClick={onProfessional}
      >
        <Table2 aria-hidden="true" size={16} />
        {t('report.proView')}
      </Button>
      <ShareDialog system={system} readingId={readingId} local={local} toolbar />
      <ExportMenu readingId={readingId} local={local} owner={owner} toolbar />
      {owner || local ? (
        <details className="report-more">
          <summary className="button button-secondary report-action">
            <Ellipsis aria-hidden="true" size={16} />
            {t('report.more')}
          </summary>
          <div className="report-more-actions">
            <Button variant="ghost" onClick={onRename}>
              {t('report.rename')}
            </Button>
            <Button variant="ghost" disabled={busy} action={onRegenerate}>
              {t('report.regenerate')}
            </Button>
            <Button variant="ghost" onClick={onDelete}>
              {t('report.delete')}
            </Button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
