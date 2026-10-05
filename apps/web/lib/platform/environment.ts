export type Platform = 'vercel' | 'cloudflare';
/** Select an explicit platform, otherwise detect Workers before falling back to Node/Vercel. */
export function platform(env: Record<string, string | undefined> = process.env): Platform {
  if (env.PLATFORM === 'cloudflare' || env.PLATFORM === 'vercel') return env.PLATFORM;
  if (env.PLATFORM) throw new Error('Invalid PLATFORM');
  return typeof navigator !== 'undefined' && navigator.userAgent.startsWith('Cloudflare')
    ? 'cloudflare'
    : 'vercel';
}
