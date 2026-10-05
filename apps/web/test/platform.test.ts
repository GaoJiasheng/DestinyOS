import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { platform } from '../lib/platform/environment';
import { readExport, writeExport } from '../lib/platform/storage';
import { createLogger } from '../lib/platform/logger';
import { scheduledMaintenance, maintenancePath } from '../lib/platform/scheduled';
import { resourceText } from '../lib/platform/resources';
import { databaseScope, withDatabaseScope } from '../lib/platform/database-scope';
import { pngDensity } from '../lib/print-png';
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  fetch: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock('../lib/platform/cloudflare', () => ({
  cloudflareBindings: async () => ({ EXPORT_BUCKET: mocks, ASSETS: { fetch: mocks.fetch } }),
}));
vi.mock('../lib/platform/storage-node', () => ({
  readExport: mocks.read,
  writeExport: mocks.write,
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('deployment platform boundaries', () => {
  it('honors explicit choice, auto-detects Workers and fails closed on typos', () => {
    expect(platform({})).toBe('vercel');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
    expect(platform({})).toBe('cloudflare');
    expect(platform({ PLATFORM: 'vercel' })).toBe('vercel');
    expect(() => platform({ PLATFORM: 'typo' })).toThrow('Invalid PLATFORM');
  });
  it('uses Node storage on Vercel and private R2 with expiry on Workers', async () => {
    vi.stubEnv('PLATFORM', 'vercel');
    mocks.read.mockResolvedValue(new Uint8Array([1]));
    expect(await readExport('node')).toEqual(new Uint8Array([1]));
    await writeExport('node', new Uint8Array([2]), 'image/png');
    expect(mocks.write).toHaveBeenCalledWith('node', new Uint8Array([2]), 'image/png');
    vi.stubEnv('PLATFORM', 'cloudflare');
    await writeExport('owner-hash', new Uint8Array([3]), 'application/pdf');
    expect(mocks.put).toHaveBeenCalledWith(
      'report-exports/owner-hash',
      new Uint8Array([3]),
      expect.objectContaining({
        httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
        customMetadata: { expires: expect.any(String) },
      }),
    );
    mocks.get.mockResolvedValue({
      customMetadata: { expires: String(Date.now() + 60000) },
      arrayBuffer: async () => new Uint8Array([3]).buffer,
    });
    expect(await readExport('owner-hash')).toEqual(new Uint8Array([3]));
    mocks.get.mockResolvedValue({ customMetadata: { expires: '0' } });
    expect(await readExport('expired')).toBeNull();
    expect(mocks.delete).toHaveBeenCalledWith('report-exports/expired');
    mocks.get.mockResolvedValue(null);
    expect(await readExport('missing')).toBeNull();
    mocks.get.mockRejectedValue(new Error('R2 unavailable'));
    await expect(readExport('error')).rejects.toThrow('R2 unavailable');
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });
  it('redacts Workers JSON logs including errors, bodies and credentials', () => {
    vi.stubEnv('PLATFORM', 'cloudflare');
    let output = '';
    const logger = createLogger({
      write(line) {
        output += line;
      },
    });
    logger.error(
      {
        birth: { year: 1990 },
        body: 'private',
        email: 'person@example.com',
        err: new Error('born 1990-02-03'),
      },
      'Failure',
    );
    const record = JSON.parse(output) as { level: string; data: { birth: string; body: string } };
    expect(record).toMatchObject({
      level: 'error',
      data: { birth: '[REDACTED]', body: '[REDACTED]' },
    });
    expect(output).not.toMatch(/1990|person@example.com|private/);
  });
  it('enters the authenticated shared Cron handler and propagates failures', async () => {
    const dispatch = vi.fn<(request: Request) => Promise<Response>>(async () => new Response('{}'));
    await scheduledMaintenance(
      { CRON_SECRET: 'isolated-secret', NEXT_PUBLIC_SITE_URL: 'https://isolated.example' },
      dispatch,
    );
    const request = dispatch.mock.calls[0]?.[0] as Request | undefined;
    expect(request?.url).toBe(`https://isolated.example${maintenancePath}`);
    expect(request?.headers.get('authorization')).toBe('Bearer isolated-secret');
    await expect(scheduledMaintenance({}, dispatch)).rejects.toThrow('Cron secret missing');
    await expect(
      scheduledMaintenance({ CRON_SECRET: 'x' }, async () => new Response('', { status: 500 })),
    ).rejects.toThrow('Daily maintenance failed');
  });
  it('reads compiled public resources through the assets binding', async () => {
    vi.stubEnv('PLATFORM', 'cloudflare');
    mocks.fetch.mockResolvedValue(new Response('corpus'));
    expect(await resourceText('../../packages/content/dist/bazi.zh.json')).toBe('corpus');
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://assets.internal/_data/workspace/packages/content/dist/bazi.zh.json',
    );
    mocks.fetch.mockResolvedValue(new Response('', { status: 404 }));
    await expect(resourceText('missing')).rejects.toThrow('Bundled resource unavailable');
  });
  it('keeps request clients separate and disconnects after streaming ends', async () => {
    const disconnect = vi.fn(async () => undefined);
    const waits: Promise<unknown>[] = [];
    const response = await withDatabaseScope(
      async () => {
        databaseScope()?.clients.set('prisma', { $disconnect: disconnect });
        return new Response('streamed answer');
      },
      (p) => {
        waits.push(p);
      },
    );
    expect(databaseScope()).toBeUndefined();
    expect(disconnect).not.toHaveBeenCalled();
    expect(await response.text()).toBe('streamed answer');
    await Promise.all(waits);
    expect(disconnect).toHaveBeenCalledOnce();
    await expect(
      withDatabaseScope(
        async () => {
          databaseScope()?.clients.set('prisma', { $disconnect: disconnect });
          throw new Error('failed');
        },
        () => undefined,
      ),
    ).rejects.toThrow('failed');
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
  it('writes valid 300dpi PNG metadata without changing any pixels or page dimensions', async () => {
    const pixels = Buffer.from(Array.from({ length: 32 * 48 * 3 }, (_, i) => i % 255));
    const input = await sharp(pixels, { raw: { width: 32, height: 48, channels: 3 } })
      .withMetadata({ density: 72 })
      .png()
      .toBuffer();
    const output = pngDensity(input);
    expect(await sharp(output).metadata()).toMatchObject({ width: 32, height: 48, density: 300 });
    expect(await sharp(output).removeAlpha().raw().toBuffer()).toEqual(pixels);
  });
});
