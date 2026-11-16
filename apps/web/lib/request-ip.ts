import { isIP } from 'node:net';

/** True inside a Cloudflare Worker, where the edge has already rewritten the client-address header. */
function onCloudflareWorkers(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
}

/**
 * Resolve a quota identity from the address the trusted edge reports; untrusted hosts share a bucket.
 * Cloudflare overwrites `CF-Connecting-IP` on every request it proxies, and Vercel does the same for
 * `X-Forwarded-For`, so each is only read on its own platform.
 */
export function requestIp(headers: Pick<Headers, 'get'>): string {
  const workers = onCloudflareWorkers();
  // DESIGN-GAP: Any other production host fails closed, because its forwarding headers are client-controlled.
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1' && !workers)
    return 'unknown';
  const candidate = workers
    ? headers.get('cf-connecting-ip')?.trim()
    : headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!candidate || candidate.includes('%') || !isIP(candidate)) return 'unknown';
  // Normalize equivalent IPv6 spellings so textual variation cannot reset the quota.
  return isIP(candidate) === 6 ? new URL(`http://[${candidate}]`).hostname.slice(1, -1) : candidate;
}
