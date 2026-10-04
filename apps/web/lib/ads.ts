/** Match only the documented fixed ad placements, excluding forms, settings and public shares. */
export function adRouteAllowed(pathname: string): boolean {
  const path = pathname.replace(/^\/(zh|en)(?=\/|$)/, '') || '/';
  return (
    path === '/' ||
    path === '/today' ||
    /^\/learn\/.+/.test(path) ||
    /^\/(bazi|ziwei|iching|qimen|tarot|astrology|vedic)\/r\/(?:local\/)?[^/]+$/.test(path)
  );
}
// DESIGN-GAP: AdSense numeric slot IDs are account-created resources; names map to env vars and missing slots render nothing.
export const adSlotEnvironment = {
  home: 'NEXT_PUBLIC_ADSENSE_SLOT_HOME',
  'report-2-3': 'NEXT_PUBLIC_ADSENSE_SLOT_REPORT_TOP',
  'report-6-7': 'NEXT_PUBLIC_ADSENSE_SLOT_REPORT_BOTTOM',
  today: 'NEXT_PUBLIC_ADSENSE_SLOT_TODAY',
  learn: 'NEXT_PUBLIC_ADSENSE_SLOT_LEARN',
} as const;
export type AdPlacement = keyof typeof adSlotEnvironment;
/** Resolve compile-time public identifiers without dynamic process.env access in browser bundles. */
export function adSlotId(placement: AdPlacement): string | undefined {
  return {
    home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
    'report-2-3': process.env.NEXT_PUBLIC_ADSENSE_SLOT_REPORT_TOP,
    'report-6-7': process.env.NEXT_PUBLIC_ADSENSE_SLOT_REPORT_BOTTOM,
    today: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TODAY,
    learn: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEARN,
  }[placement];
}
export type AdPolicy = {
  enabled: boolean;
  plan: 'free' | 'pro';
  underAge: boolean;
  blocked: boolean;
};
