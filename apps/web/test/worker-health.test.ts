import { expect, it, vi } from 'vitest';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { workerHealth } from '../lib/platform/worker-health';
it('probes native D1/KV, caches only successful checks, and retains public health keys', async () => {
  const first = vi.fn(async () => ({ value: 1 }));
  const prepare = vi.fn(() => ({ first }));
  const get = vi.fn(async () => null);
  let stored: Response | undefined;
  const cache = {
    match: async () => stored?.clone(),
    put: async (_key: Request, value: Response) => {
      stored = value;
    },
  } as unknown as Cache;
  const pending: Promise<unknown>[] = [];
  const probe = () =>
    workerHealth(
      { prepare } as unknown as D1Database,
      { get } as unknown as KVNamespace,
      cache,
      new Request('https://example.test/api/v1/health'),
      (p) => pending.push(p),
    );
  const response = await probe();
  expect(await response.json()).toMatchObject({ ok: true, db: true, redis: true });
  expect(prepare).toHaveBeenCalledWith('SELECT 1');
  await Promise.all(pending);
  expect((await probe()).headers.get('X-Destiny-Health')).toBe('HIT');
  expect(first).toHaveBeenCalledOnce();
  stored = undefined;
  first.mockRejectedValueOnce(new Error('unavailable'));
  const failure = await probe();
  expect(failure.status).toBe(503);
  expect(stored).toBeUndefined();
  expect(await failure.json()).toMatchObject({ ok: false, db: false, redis: true });
});
