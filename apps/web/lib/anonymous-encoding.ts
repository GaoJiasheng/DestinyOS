// Dependency-free so the root layout can listen for evictions without loading the snapshot schemas.
/** Window event fired after a write had to drop old readings to fit the browser storage quota. */
export const anonymousEvictionEvent = 'tianji:anon-evicted';
export type AnonymousEviction = { count: number };
/** Standard base64 for binary envelope fields; chunked so large snapshots do not overflow the call stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
/** Browsers name a full localStorage differently (Firefox used NS_ERROR_DOM_QUOTA_REACHED / code 1014). */
export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}
