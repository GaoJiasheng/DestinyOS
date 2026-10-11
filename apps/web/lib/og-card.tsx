import { platform } from './platform/environment';
import { mediaRequest } from './platform/media-client';
import type { PublicShare, DailyCard } from './share-projection';
/** Extract bounded display text shared by all three image templates; this is also the privacy test boundary. */
export function cardText(card: PublicShare | DailyCard) {
  return 'system' in card
    ? [card.headline, ...card.keywords.slice(0, 4)]
    : [card.headline, card.color, card.numbers.join(' / '), ...card.do, ...card.dont];
}
/** Dispatch image generation through the media binding in Workers, retaining local Node rendering. */
export async function renderCard(
  card: PublicShare | DailyCard,
  format: 'story' | 'landscape' = 'landscape',
  destination?: string,
): Promise<Response> {
  if (platform() !== 'cloudflare')
    return (await import('./og-card-render')).renderCard(card, format, destination);
  return mediaRequest('/card', { card, format, destination });
}
