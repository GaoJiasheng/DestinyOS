import type { ArtAssetId } from './art';

/** Small runtime entry point so bitmap consumers need not download the full asset registry. */
export function artUrl(id: ArtAssetId, format: 'webp' | 'png' = 'webp'): string {
  return `/art/${id}.${format}`;
}
