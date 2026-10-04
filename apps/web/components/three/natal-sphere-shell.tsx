'use client';
import { useTranslations } from 'next-intl';
/** Deferred 3D mount point; SVG remains available while the T-37b renderer is pending. */
export default function NatalSphereShell() {
  const t = useTranslations();
  // TODO(T-37b): After T-38, mount the Three.js celestial sphere with the shared capability and FPS fallback policy.
  return (
    <aside className="notice" role="status" data-three-shell>
      {t('charts.natal.threePending')}
    </aside>
  );
}
