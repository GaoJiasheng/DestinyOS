'use client';
import { useCopy } from '@/i18n/use-copy';
/** Gold breathing placeholders mirror the page's heading, controls and content columns. */
export function RouteSkeleton({
  kind = 'landing',
}: {
  kind?: 'landing' | 'report' | 'form' | 'daily' | 'learn' | 'account';
}) {
  const t = useCopy();
  return (
    <section
      className={`route-skeleton skeleton-${kind}`}
      role="status"
      aria-label={t('common.loading')}
      aria-busy="true"
    >
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true">
        <div className="skeleton-gold skeleton-heading" />
        <div className="skeleton-gold skeleton-line" />
        <div className="skeleton-controls">
          {[0, 1, 2].map((n) => (
            <div key={n} className="skeleton-gold" />
          ))}
        </div>
        <div className="skeleton-columns">
          {Array.from({ length: kind === 'learn' ? 6 : kind === 'daily' ? 5 : 3 }, (_, n) => (
            <div className="skeleton-panel" key={n}>
              <div className="skeleton-gold skeleton-line" />
              <div className="skeleton-gold skeleton-block" />
              <div className="skeleton-gold skeleton-line" />
              <div className="skeleton-gold skeleton-line" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
