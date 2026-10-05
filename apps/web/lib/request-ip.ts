import { isIP } from 'node:net';

/** Resolve a quota identity from Vercel's overwritten forwarding header; untrusted hosts share a bucket. */
export function requestIp(headers: Pick<Headers, 'get'>): string {
  // DESIGN-GAP: Only the documented Vercel deployment is a trusted production proxy;
  // other production hosts fail closed until an authenticated proxy integration is implemented.
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') return 'unknown';
  const candidate = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!candidate || candidate.includes('%') || !isIP(candidate)) return 'unknown';
  // Normalize equivalent IPv6 spellings so textual variation cannot reset the quota.
  return isIP(candidate) === 6 ? new URL(`http://[${candidate}]`).hostname.slice(1, -1) : candidate;
}
