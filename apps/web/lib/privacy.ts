const privateKeys =
  /^(?:birth|birthInput|normalizedBirth|enc\w+|question|email|authorization|cookie|password|token|sessionToken|access_token|refresh_token|id_token|secret)$/i;

/** Scrub dates, email addresses and sensitive URL parameters from telemetry strings. */
export function scrubText(value: string): string {
  return value
    .replace(/\d{4}-\d{2}-\d{2}/g, '[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
    .replace(/((?:question|email|token|code)=)[^&#\s]*/gi, '$1[REDACTED]');
}

/** Recursively sanitize arbitrary telemetry, including nested objects and serialized errors. */
export function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (value instanceof Date) return '[REDACTED]';
  if (value instanceof Error)
    return sanitize({ name: value.name, message: value.message, stack: value.stack }, seen);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      privateKeys.test(key) ? '[REDACTED]' : sanitize(item, seen),
    ]),
  );
}
