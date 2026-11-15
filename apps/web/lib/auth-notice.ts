/** Auth.js `?error=` value used when a soft-deleted account tries to sign in again. */
export const accountDeletedError = 'AccountDeleted';
const dayMs = 86400000;

/**
 * Earliest UTC date (YYYY-MM-DD) the email can register again. Accounts are purged by a daily cron
 * once they are seven days old, so one extra day covers the gap until that run.
 */
export function reRegisterDate(deletedAt: Date): string {
  return new Date(deletedAt.getTime() + 8 * dayMs).toISOString().slice(0, 10);
}

/** Relative login path that tells a deleted account when it may register again. */
export function deletedAccountPath(deletedAt: Date): string {
  const query = new URLSearchParams({
    error: accountDeletedError,
    until: reRegisterDate(deletedAt),
  });
  return `/auth/login?${query.toString()}`;
}

/** Accept only a plain calendar date from the query string. */
export function parseUntil(raw: unknown): string | undefined {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/** Long localized date for an `until` value; the date is a UTC calendar day. */
export function formatUntil(until: string, locale: string): string {
  const date = new Date(`${until}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return until;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

/** Message key for an Auth.js (or local) error code shown on the login page. */
export function authErrorKey(
  code: string,
):
  | 'auth.error.oauthNotLinked'
  | 'auth.error.accessDenied'
  | 'auth.error.verification'
  | 'auth.error.accountDeleted'
  | 'auth.error.generic' {
  switch (code) {
    case 'OAuthAccountNotLinked':
      return 'auth.error.oauthNotLinked';
    case 'AccessDenied':
      return 'auth.error.accessDenied';
    case 'Verification':
      return 'auth.error.verification';
    case accountDeletedError:
      return 'auth.error.accountDeleted';
    default:
      return 'auth.error.generic';
  }
}
