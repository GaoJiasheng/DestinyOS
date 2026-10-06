/** Generated bitmap dimensions and paths shared by Web, Skia and native renderers. */
// DESIGN-GAP: An explicit package subpath keeps Expo's native TypeScript config loading independent of extensionless nested imports.
export const artAssets = {
  'systems/bazi': {
    width: 1536,
    height: 1536,
  },
  'systems/bazi-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/ziwei': {
    width: 1536,
    height: 1536,
  },
  'systems/ziwei-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/iching': {
    width: 1536,
    height: 1536,
  },
  'systems/iching-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/qimen': {
    width: 1536,
    height: 1536,
  },
  'systems/qimen-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/tarot': {
    width: 1536,
    height: 1536,
  },
  'systems/tarot-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/astrology': {
    width: 1536,
    height: 1536,
  },
  'systems/astrology-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/vedic': {
    width: 1536,
    height: 1536,
  },
  'systems/vedic-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/numerology': {
    width: 1536,
    height: 1536,
  },
  'systems/numerology-banner': {
    width: 1920,
    height: 1080,
  },
  'systems/synastry': {
    width: 1536,
    height: 1536,
  },
  'systems/synastry-banner': {
    width: 1920,
    height: 1080,
  },
  'spreads/single': {
    width: 1024,
    height: 1024,
  },
  'spreads/yes-no': {
    width: 1024,
    height: 1024,
  },
  'spreads/three-ppf': {
    width: 1024,
    height: 1024,
  },
  'spreads/three-sao': {
    width: 1024,
    height: 1024,
  },
  'spreads/relationship': {
    width: 1024,
    height: 1024,
  },
  'spreads/decision': {
    width: 1024,
    height: 1024,
  },
  'spreads/celtic-cross': {
    width: 1024,
    height: 1024,
  },
  'spreads/year-ahead': {
    width: 1024,
    height: 1024,
  },
  'tarot/card-back': {
    width: 1200,
    height: 2100,
  },
  'hero/galaxy': {
    width: 3840,
    height: 2160,
  },
  'hero/ink-clouds': {
    width: 2048,
    height: 2048,
  },
  'states/no-profile': {
    width: 1024,
    height: 1024,
  },
  'states/no-report': {
    width: 1024,
    height: 1024,
  },
  'states/offline': {
    width: 1024,
    height: 1024,
  },
  'states/error': {
    width: 1024,
    height: 1024,
  },
  'states/login': {
    width: 1024,
    height: 1024,
  },
  'states/disclaimer': {
    width: 1024,
    height: 1024,
  },
  'share/chart-portrait': {
    width: 1080,
    height: 1920,
  },
  'share/chart-landscape': {
    width: 1200,
    height: 630,
  },
  'share/quote-portrait': {
    width: 1080,
    height: 1920,
  },
  'share/quote-landscape': {
    width: 1200,
    height: 630,
  },
  'share/daily-portrait': {
    width: 1080,
    height: 1920,
  },
  'share/daily-landscape': {
    width: 1200,
    height: 630,
  },
  'brand/app-icon': {
    width: 1024,
    height: 1024,
  },
  'brand/og-default': {
    width: 1200,
    height: 630,
  },
  'brand/apple-launch': {
    width: 2732,
    height: 2732,
  },
  'daily/lucky-color': {
    width: 512,
    height: 512,
  },
  'daily/lucky-number': {
    width: 512,
    height: 512,
  },
  'daily/direction': {
    width: 512,
    height: 512,
  },
  'daily/hour': {
    width: 512,
    height: 512,
  },
  'daily/benefactor': {
    width: 512,
    height: 512,
  },
  'daily/do-dont': {
    width: 512,
    height: 512,
  },
  'charts/qimen': {
    width: 2048,
    height: 2048,
  },
  'charts/ziwei': {
    width: 2048,
    height: 2048,
  },
  'charts/astrology': {
    width: 2048,
    height: 2048,
  },
} as const;
export type ArtAssetId = keyof typeof artAssets;
export const artSystems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
  'synastry',
] as const;
export type ArtSystem = (typeof artSystems)[number];
/** Narrow a route segment to a system with an approved illustration. */
export function isArtSystem(value: string): value is ArtSystem {
  return artSystems.some((system) => system === value);
}
/** Public asset URL; callers can prefix the site origin for native image sources. */
export { artUrl } from '@tianji/ui-core/art-path';
export const artTextures = {
  galaxy: '/art/hero/galaxy.webp',
  inkClouds: '/art/hero/ink-clouds.webp',
  qimen: '/art/charts/qimen.webp',
  ziwei: '/art/charts/ziwei.webp',
  astrology: '/art/charts/astrology.webp',
  tarotBack: '/art/tarot/card-back.webp',
} as const;
