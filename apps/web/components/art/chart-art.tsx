import { useTranslations } from 'next-intl';
import { ArtImage } from './art-image';
import { artAssets } from '@tianji/ui-core/art';

/** Decorative bitmap below the interactive chart, with no hit targets or encoded chart data. */
export function ChartArt({
  system,
  priority = false,
}: {
  system: 'qimen' | 'ziwei' | 'astrology';
  priority?: boolean;
}) {
  const t = useTranslations('art');
  return (
    <ArtImage
      asset={`charts/${system}`}
      {...artAssets[`charts/${system}`]}
      alt={t(`systems.${system}`)}
      className="chart-art"
      priority={priority}
      sizes="(min-width: 768px) 680px, 100vw"
    />
  );
}
