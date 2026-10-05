'use client';
import { useCopy } from '@/i18n/use-copy';
/** Full-screen ritual transition; callers wait for both calculation and the 1.2-second minimum. */
export function DivinationLoader() {
  const t = useCopy();
  return (
    <div className="divination-loader" role="status" aria-live="polite">
      <div className="ritual-pillars" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <h2 className="type-h2">{t('form.birth.loader')}</h2>
      <p className="muted">{t('form.birth.loader.quote')}</p>
    </div>
  );
}
