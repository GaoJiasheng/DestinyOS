'use client';
import { useCopy } from '@/i18n/use-copy';
/**
 * Stand-in for a lazily loaded panel whose chunk could not be fetched, which is what happens when
 * a saved report is opened offline and the panel was never loaded on this device. Without it the
 * rejected import reaches the error boundary and replaces the whole report.
 */
export function ChunkUnavailable() {
  const t = useCopy();
  return (
    <p role="status" className="muted chunk-loading">
      {t('report.needsNetwork')}
    </p>
  );
}
