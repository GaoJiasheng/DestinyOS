import { artUrl, type ArtAssetId } from '@tianji/ui-core/art';
import { resourceBytes } from './platform/resources';

/** Embed a trusted generated PNG in Satori without external requests or private image data. */
export async function artDataUrl(asset: ArtAssetId): Promise<string> {
  const data = await resourceBytes(`public${artUrl(asset, 'png')}`);
  return `data:image/png;base64,${data.toString('base64')}`;
}
