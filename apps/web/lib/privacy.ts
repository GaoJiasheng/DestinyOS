const privateKeys =
  /^(?:journal|journalEntry|journalEntries|journalText|mood|text|birth|birthInput|normalizedBirth|birthYear|birthDate|dateOfBirth|dob|year|month|day|hour|minute|place|lat|lng|latitude|longitude|displayName|questionText|body|headers|cookies|query_string|queryString|enc\w+|question|email|authorization|cookie|password|token|sessionToken|access_token|refresh_token|id_token|secret|accessToken|refreshToken|idToken|codeVerifier|nonce|deviceName)$/i;

/** Scrub dates, email addresses and sensitive URL parameters from telemetry strings. */
export function scrubText(value: string): string {
  // DESIGN-GAP: Decode bounded URL encoding before scrubbing, including nested callback URLs.
  for (let pass = 0; pass < 3; pass++) {
    value = value.replace(/(?:%[0-9a-f]{2})+/gi, (encoded) => {
      try {
        return decodeURIComponent(encoded);
      } catch {
        return '[REDACTED]';
      }
    });
  }
  return (
    value
      // URL query values can encode a birth as separate year/month/day fields or free text.
      .replace(/((?:https?:\/\/|\/)[^\s?#]*\?)[^\r\n]*/gi, '$1[REDACTED]')
      .replace(/\d{4}-\d{2}-\d{2}/g, '[REDACTED]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
      .replace(
        /((?:question|email|token|code|state|nonce|signature|payload|password|secret|access_token|refresh_token|id_token)=)[^\r\n]*/gi,
        '$1[REDACTED]',
      )
  );
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
