import { ArtImage } from './art-image';
import { artAssets } from '@tianji/ui-core/art';

/** Small generated decoration next to a translated daily-fortune indicator. */
export function DailyArt({
  kind,
  alt,
}: {
  kind: 'lucky-color' | 'lucky-number' | 'direction' | 'hour' | 'benefactor' | 'do-dont';
  alt: string;
}) {
  return (
    <ArtImage
      asset={`daily/${kind}`}
      {...artAssets[`daily/${kind}`]}
      alt={alt}
      className="daily-art"
      sizes="64px"
    />
  );
}
