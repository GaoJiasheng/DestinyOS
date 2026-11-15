import { describe, expect, it } from 'vitest';
import { safeReturnPath } from '../app/[locale]/auth/return-path';

describe('login return path', () => {
  it('keeps same-origin relative paths with their query and fragment', () => {
    expect(safeReturnPath('/zh/me/profiles', 'zh')).toBe('/zh/me/profiles');
    expect(safeReturnPath('/en/today?date=2026-11-15#week', 'zh')).toBe(
      '/en/today?date=2026-11-15#week',
    );
    expect(safeReturnPath('/zh-TW/bazi/r/abc', 'en')).toBe('/zh-TW/bazi/r/abc');
  });

  it('places paths without a locale under the current locale', () => {
    expect(safeReturnPath('/me/billing', 'en')).toBe('/en/me/billing');
    expect(safeReturnPath('/pricing', 'zh-TW')).toBe('/zh-TW/pricing');
    expect(safeReturnPath('/', 'en')).toBe('/en');
    expect(safeReturnPath('/admin', 'zh')).toBe('/admin');
  });

  it('rejects external, protocol-relative and malformed destinations', () => {
    for (const raw of [
      'https://evil.example/zh',
      '//evil.example/zh',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      'zh/me',
      '/zh/\n/evil',
      '',
      `/${'a'.repeat(600)}`,
      undefined,
      null,
      42,
    ])
      expect(safeReturnPath(raw, 'zh')).toBe('/zh');
  });

  it('never returns to the auth screens and falls back for an unsupported locale', () => {
    expect(safeReturnPath('/zh/auth/login?callbackUrl=/zh', 'zh')).toBe('/zh');
    expect(safeReturnPath('/auth/verify', 'en')).toBe('/en');
    expect(safeReturnPath('https://evil.example', 'fr')).toBe('/zh');
  });
});
