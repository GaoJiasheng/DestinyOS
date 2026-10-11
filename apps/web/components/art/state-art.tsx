import { useTranslations } from 'next-intl';
import { ArtImage } from './art-image';

/** Consistent localized illustration for empty, onboarding and failure states. */
export function StateArt({
  state,
  priority = false,
}: {
  state: 'no-profile' | 'no-report' | 'offline' | 'error' | 'login' | 'disclaimer';
  priority?: boolean;
}) {
  const t = useTranslations('art');
  return (
    <ArtImage
      asset={`states/${state}`}
      alt={t(`states.${state}`)}
      className="state-art"
      sizes="(min-width: 640px) 240px, 180px"
      priority={priority}
    />
  );
}
