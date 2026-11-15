'use client';
import { useCopy } from '@/i18n/use-copy';
/**
 * In-place fallback for a lazily loaded panel that mounts after a user action.
 * Without a `loading` option next/dynamic adds no Suspense boundary, so the nearest route boundary
 * hides the whole page behind its skeleton, and components above the panel re-run their effects.
 */
export function ChunkLoading() {
  const t = useCopy();
  return (
    <p role="status" className="muted chunk-loading">
      {t('common.loading')}
    </p>
  );
}
