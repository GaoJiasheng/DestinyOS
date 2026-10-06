/** Reject malformed or non-HTTPS store links; empty links represent an unpublished App. */
export function appStoreUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
/** Choose the native store only on a recognized mobile browser. */
// DESIGN-GAP: iPad desktop mode uses touch-capable Mac identification; other devices see both store choices.
export function mobileStore(agent: string, touches: number): 'apple' | 'google' | null {
  if (/Android/i.test(agent)) return 'google';
  if (/iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && touches > 1)) return 'apple';
  return null;
}
