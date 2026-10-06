import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import versions from '../i18n/glossary-versions.json';
const mocks = vi.hoisted(() => ({
  text: vi.fn<(path: string) => Promise<string>>(),
  get: vi.fn<(key: string) => Promise<string | null>>(),
  put: vi.fn<(key: string, value: string, options: { expirationTtl: number }) => Promise<void>>(),
}));
vi.mock('../lib/platform/resources', () => ({ resourceText: mocks.text }));
vi.mock('../lib/platform/cloudflare', () => ({
  cloudflareBindings: async () => ({ CACHE: { get: mocks.get, put: mocks.put } }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('PLATFORM', 'cloudflare');
  vi.stubEnv('NEXT_PHASE', '');
  mocks.get.mockResolvedValue(null);
  mocks.put.mockResolvedValue(undefined);
  mocks.text.mockImplementation(async (path) => JSON.stringify({ 'glossary.test.term': path }));
});
afterEach(() => vi.unstubAllEnvs());

it('loads locales on demand, hashes KV keys and shares concurrent and repeated reads in memory', async () => {
  const { loadGlossary } = await import('../i18n/glossary');
  const [first, second] = await Promise.all([loadGlossary('en'), loadGlossary('en')]);
  expect(first).toBe(second);
  expect(await loadGlossary('en')).toBe(first);
  expect(mocks.text).toHaveBeenCalledExactlyOnceWith('messages/en/glossary.json');
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith(`glossary:${versions.en}:en`);
  expect(mocks.put).toHaveBeenCalledWith(`glossary:${versions.en}:en`, expect.any(String), {
    expirationTtl: 3600,
  });
  await loadGlossary('zh-TW');
  expect(mocks.text).toHaveBeenLastCalledWith('messages/zh-TW/glossary.json');
});

it('uses validated KV entries without fetching Assets', async () => {
  mocks.get.mockResolvedValue(JSON.stringify({ 'glossary.test.term': '缓存' }));
  const { loadGlossary } = await import('../i18n/glossary');
  expect(await loadGlossary('zh')).toEqual({ 'glossary.test.term': '缓存' });
  expect(mocks.text).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();
});

it('falls back to Assets for invalid or unavailable KV and survives a write outage', async () => {
  mocks.get.mockResolvedValueOnce('{invalid').mockRejectedValueOnce(new Error('KV offline'));
  mocks.put.mockRejectedValue(new Error('KV offline'));
  const { loadGlossary } = await import('../i18n/glossary');
  expect(await loadGlossary('zh')).toHaveProperty('glossary.test.term');
  expect(await loadGlossary('en')).toHaveProperty('glossary.test.term');
  expect(mocks.text).toHaveBeenCalledTimes(2);
});

it('retries an Assets failure instead of caching a rejected promise', async () => {
  mocks.text.mockRejectedValueOnce(new Error('Assets offline'));
  const { loadGlossary } = await import('../i18n/glossary');
  await expect(loadGlossary('en')).rejects.toThrow('Assets offline');
  await expect(loadGlossary('en')).resolves.toHaveProperty('glossary.test.term');
  expect(mocks.text).toHaveBeenCalledTimes(2);
});

it.each(['local', 'build'])('%s reads traced files and never requires KV', async (mode) => {
  if (mode === 'local') vi.stubEnv('PLATFORM', 'vercel');
  else vi.stubEnv('NEXT_PHASE', 'phase-production-build');
  const { loadGlossary } = await import('../i18n/glossary');
  await loadGlossary('en');
  expect(mocks.text).toHaveBeenCalledExactlyOnceWith('messages/en/glossary.json');
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.put).not.toHaveBeenCalled();
});
