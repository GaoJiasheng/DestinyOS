import { describe, it, expect, vi, afterEach } from 'vitest';
import { canExport, ExportRequestSchema } from '../lib/report-export-schema';
import { RATE_LIMITS } from '../lib/ratelimit';
vi.mock('../lib/auth', () => ({ auth: vi.fn() }));
import { printToken, verifyPrintToken, exportKey, exportFilename } from '../lib/report-export';
import { baziReading } from './fixtures/bazi-reading';
const request = ExportRequestSchema.parse({ readingId: 'r-example', locale: 'zh', format: 'pdf' });
afterEach(() => vi.unstubAllEnvs());
describe('report exports', () => {
  it('requires membership only when free exports are disabled', () => {
    expect(canExport('free', true)).toBe(true);
    expect(canExport('free', false)).toBe(false);
    expect(canExport('pro', false)).toBe(true);
    expect(RATE_LIMITS.export).toBe(10);
  });
  it('rejects URLs, paths and unknown formats at the API boundary', () => {
    for (const readingId of ['../private', 'https://example.com', 'a/b'])
      expect(ExportRequestSchema.safeParse({ ...request, readingId }).success).toBe(false);
    expect(ExportRequestSchema.safeParse({ ...request, format: 'html' }).success).toBe(false);
  });
  it('binds signed renderer capabilities to report, locale, theme, owner and expiry', () => {
    vi.stubEnv('AUTH_SECRET', 'export-unit-secret');
    const token = printToken('owner', request);
    expect(verifyPrintToken(token, request)).toBe('owner');
    expect(verifyPrintToken(token, { ...request, theme: 'light' })).toBeNull();
    expect(verifyPrintToken(token, { ...request, locale: 'en' })).toBeNull();
    expect(verifyPrintToken(token, { ...request, readingId: 'other' })).toBeNull();
    expect(verifyPrintToken(token + 'x', request)).toBeNull();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 360000);
    expect(verifyPrintToken(token, request)).toBeNull();
    vi.restoreAllMocks();
  });
  it('invalidates on content changes and isolates owners, themes, locales and formats', () => {
    const reading = baziReading('zh'),
      key = exportKey(request, reading, 'owner');
    expect(exportKey({ ...request, theme: 'light' }, reading, 'owner')).not.toBe(key);
    expect(exportKey({ ...request, locale: 'en' }, reading, 'owner')).not.toBe(key);
    expect(exportKey({ ...request, format: 'png' }, reading, 'owner')).not.toBe(key);
    expect(exportKey(request, reading, 'other')).not.toBe(key);
    expect(
      exportKey(
        request,
        {
          ...reading,
          report: {
            ...reading.report,
            headline: { ...reading.report.headline, persona: 'Updated' },
          },
        },
        'owner',
      ),
    ).not.toBe(key);
    reading.displayName = 'Private name';
    expect(exportFilename(request, reading)).toBe('bazi-2026-10-05-zh.pdf');
  });
});
