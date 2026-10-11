import { useTranslations } from 'next-intl';
import { artAssets, type ArtSystem, type ArtAssetId } from '@tianji/ui-core/art';
import { ArtImage } from './art-image';

/** Shared system illustration, optionally in the wide landing-page composition. */
export function SystemArt({
  system,
  banner = false,
  priority = false,
}: {
  system: ArtSystem;
  banner?: boolean;
  priority?: boolean;
}) {
  const t = useTranslations('art');
  const asset: ArtAssetId = `systems/${system}${banner ? '-banner' : ''}`;
  return (
    <ArtImage
      asset={asset}
      {...artAssets[asset]}
      alt={t(`systems.${system}`)}
      className={banner ? 'system-banner' : 'system-art'}
      sizes={
        banner
          ? '(min-width: 1120px) 1120px, 100vw'
          : '(min-width: 1024px) 280px, (min-width: 640px) 240px, 160px'
      }
      priority={priority}
    />
  );
}
