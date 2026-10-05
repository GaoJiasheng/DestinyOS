import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { adRouteAllowed } from '../lib/ads';
import { securityHeaders, reportOnlyCsp } from '../lib/security-headers';
import { toMessages } from '../i18n/catalog';
import { subscriptionPlan } from '../lib/stripe';
const require = createRequire(import.meta.url);
const lhci = createRequire(require.resolve('@lhci/cli/package.json'));
const lighthouse = createRequire(lhci.resolve('lighthouse/package.json'));
const puppeteer = createRequire(lighthouse.resolve('puppeteer-core/package.json'));
const browsers = createRequire(puppeteer.resolve('@puppeteer/browsers'));
const extract: (path: string, options: { dir: string }) => Promise<void> = browsers('extract-zip');
function maliciousZip(
  entries: Array<{ name: string; text: string; symlink: boolean }>,
): Uint8Array {
  const zip = zipSync(
    Object.fromEntries(entries.map((e, index) => [`entry-${index}`, strToU8(e.text)])),
    { level: 0 },
  );
  // Rewrite same-length entry names and UNIX file modes to construct fixtures including duplicate paths.
  const bytes = Buffer.from(zip);
  let entry = 0,
    central = 0;
  for (let i = 0; i < bytes.length - 30; i++) {
    const signature = bytes.readUInt32LE(i);
    if (signature === 0x04034b50) {
      const fixture = entries[entry++];
      if (!fixture) continue;
      bytes.write(fixture.name, i + 30);
    } else if (signature === 0x02014b50) {
      const fixture = entries[central++];
      if (!fixture) continue;
      bytes.write(fixture.name, i + 46);
      bytes.writeUInt16LE(3 << 8, i + 4);
      bytes.writeUInt32LE(((fixture.symlink ? 0o120777 : 0o100644) << 16) >>> 0, i + 38);
    }
  }
  return bytes;
}
describe('M4 policy boundaries', () => {
  it('allows only documented content routes in both languages', () => {
    for (const locale of ['zh', 'en']) {
      for (const path of ['', '/today', '/learn/bazi', '/bazi/r/id', '/tarot/r/local/id'])
        expect(adRouteAllowed(`/${locale}${path}`)).toBe(true);
      for (const path of [
        '/privacy',
        '/terms',
        '/disclaimer',
        '/pricing',
        '/auth/login',
        '/me/settings',
        '/me/birth',
        '/tarot/reading',
        '/bazi/new',
        '/s/token',
        '/admin',
      ])
        expect(adRouteAllowed(`/${locale}${path}`)).toBe(false);
    }
  });
  it('only active/trialing states retain Pro', () => {
    expect(subscriptionPlan('active')).toBe('pro');
    expect(subscriptionPlan('trialing')).toBe('pro');
    for (const status of ['past_due', 'unpaid', 'canceled', 'incomplete'])
      expect(subscriptionPlan(status)).toBe('free');
  });
  it('sets security headers and a nonce-bearing report-only collection policy', () => {
    expect(securityHeaders()).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' });
    expect(securityHeaders()).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' });
    expect(securityHeaders()).toContainEqual({
      key: 'Content-Security-Policy',
      value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
    });
    expect(reportOnlyCsp('unique')).toContain("'nonce-unique'");
    expect(reportOnlyCsp('unique')).toContain('report-uri /api/v1/csp/report');
    expect(reportOnlyCsp('unique')).not.toContain("'unsafe-eval'");
    expect(reportOnlyCsp('unique', true)).toContain("'unsafe-eval'");
    expect(reportOnlyCsp('unique', false)).not.toContain("'unsafe-eval'");
  });
  it('rejects dangerous catalog key paths before they can pollute prototypes', () => {
    expect(() => toMessages({ '__proto__.m4': 'bad' })).toThrow('Reserved translation key');
    expect(() => toMessages({ 'constructor.prototype.m4': 'bad' })).toThrow(
      'Reserved translation key',
    );
    expect(Object.prototype).not.toHaveProperty('m4');
  });
  it('backported ZIP guard blocks escape symlinks and duplicate writes through existing symlinks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'm4-zip-'));
    try {
      const archive = join(dir, 'input.zip');
      await writeFile(
        archive,
        maliciousZip([{ name: 'entry-0', text: '../outside', symlink: true }]),
      );
      await expect(extract(archive, { dir: join(dir, 'escape') })).rejects.toThrow(
        'symlink target escapes',
      );
      await writeFile(
        archive,
        maliciousZip([
          { name: 'entry-0', text: 'entry-2', symlink: true },
          { name: 'entry-0', text: 'overwrite', symlink: false },
        ]),
      );
      await expect(extract(archive, { dir: join(dir, 'duplicate') })).rejects.toThrow();
      await writeFile(archive, zipSync({ safe: strToU8('safe') }));
      await extract(archive, { dir: join(dir, 'safe') });
      expect(await readFile(join(dir, 'safe/safe'), 'utf8')).toBe('safe');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
