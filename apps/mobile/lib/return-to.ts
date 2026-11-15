import type { Href } from 'expo-router';

/**
 * Accept only in-app absolute paths as a post-login destination: no scheme, host or
 * protocol-relative form, and never back into the auth routes themselves.
 */
export function safeReturnTo(value: unknown): Href | undefined {
  if (typeof value !== 'string' || value.length > 512) return undefined;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;
  if (/[\s:]/.test(value.split(/[?#]/)[0]!)) return undefined;
  if (value === '/auth' || value.startsWith('/auth/')) return undefined;
  return value as Href;
}
