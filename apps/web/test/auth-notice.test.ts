import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api-error';
import { runAction } from '../lib/action-result';
import { failureRetryAfter, retryWait } from '../lib/retry-wait';
import {
  authErrorKey,
  deletedAccountPath,
  formatUntil,
  parseUntil,
  reRegisterDate,
} from '../lib/auth-notice';
import zh from '../messages/zh.json';
import en from '../messages/en.json';

describe('login error notices', () => {
  it('maps Auth.js codes to distinct keys and falls back to a generic message', () => {
    expect(authErrorKey('OAuthAccountNotLinked')).toBe('auth.error.oauthNotLinked');
    expect(authErrorKey('AccessDenied')).toBe('auth.error.accessDenied');
    expect(authErrorKey('Verification')).toBe('auth.error.verification');
    expect(authErrorKey('AccountDeleted')).toBe('auth.error.accountDeleted');
    expect(authErrorKey('Configuration')).toBe('auth.error.generic');
    expect(authErrorKey('<script>')).toBe('auth.error.generic');
    for (const code of [
      'OAuthAccountNotLinked',
      'AccessDenied',
      'Verification',
      'AccountDeleted',
      'x',
    ])
      for (const copy of [zh, en]) expect(copy[authErrorKey(code)]).toBeTruthy();
  });

  it('allows one day after the seven-day purge before promising re-registration', () => {
    const deletedAt = new Date('2026-11-15T22:30:00Z');
    expect(reRegisterDate(deletedAt)).toBe('2026-11-23');
    expect(deletedAccountPath(deletedAt)).toBe('/auth/login?error=AccountDeleted&until=2026-11-23');
  });

  it('accepts only calendar dates from the query and formats them per locale', () => {
    expect(parseUntil('2026-11-23')).toBe('2026-11-23');
    expect(parseUntil('2026-11-23T00:00')).toBeUndefined();
    expect(parseUntil(['2026-11-23'])).toBeUndefined();
    expect(formatUntil('2026-11-23', 'en')).toBe('November 23, 2026');
    expect(formatUntil('2026-11-23', 'zh')).toBe('2026年11月23日');
  });
});

describe('retry waits', () => {
  it('shows seconds under a minute and whole minutes above', () => {
    expect(retryWait(undefined)).toEqual({ unit: 'seconds', count: 1 });
    expect(retryWait(42.2)).toEqual({ unit: 'seconds', count: 43 });
    expect(retryWait(60)).toEqual({ unit: 'minutes', count: 1 });
    expect(retryWait(3599)).toEqual({ unit: 'minutes', count: 60 });
  });

  it('carries retryAfter through runAction only for rate-limited failures', async () => {
    const limited = await runAction(async () => {
      throw new ApiError('E_RATE_LIMITED', 'Too many', 429, { retryAfter: 120 });
    });
    expect(limited).toEqual({ ok: false, error: { code: 'E_RATE_LIMITED', retryAfter: 120 } });
    if (!limited.ok) expect(failureRetryAfter(limited.error)).toBe(120);
    const plain = await runAction(async () => {
      throw new ApiError('E_FORBIDDEN', 'No', 403);
    });
    expect(plain).toEqual({ ok: false, error: { code: 'E_FORBIDDEN' } });
    if (!plain.ok) expect(failureRetryAfter(plain.error)).toBeUndefined();
  });
});
