import { describe, expect, it, vi } from 'vitest';
import { importInBatches, profileStored } from '../lib/import-batches';
import type { AnonymousData } from '../lib/anonymous-storage';

const reading = (n: number) =>
  ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    request: {},
    chart: {},
    meta: {},
    createdAt: '2026-11-01T00:00:00.000Z',
  }) as unknown as AnonymousData['readings'][number];
const device = (count: number, profile = false): AnonymousData => ({
  anonId: '00000000-0000-4000-8000-000000000000',
  readings: Array.from({ length: count }, (_, i) => reading(i + 1)),
  settings: {},
  ...(profile
    ? {
        profile: {
          calendar: 'gregorian',
          year: 1990,
          month: 1,
          day: 1,
          timeUnknown: true,
          gender: 'unspecified',
        } as AnonymousData['profile'],
      }
    : {}),
});

describe('importInBatches', () => {
  it('sends batches of ten with the profile only once, counting each item and reporting progress', async () => {
    const send = vi.fn(async (payload: { readings: unknown[]; profile?: unknown }) => ({
      ok: true as const,
      data: {
        results: payload.readings.map((_, i) =>
          i === 0
            ? { status: 'failed' as const, code: 'E_VALIDATION' }
            : { status: 'imported' as const, readingId: `r${i}` },
        ),
        profile: 'savedOther' as const,
      },
    }));
    const progress = vi.fn();
    const result = await importInBatches(device(23, true), true, send, progress);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.map(([p]) => p.readings.length)).toEqual([10, 10, 3]);
    expect(send.mock.calls.map(([p]) => Boolean(p.profile))).toEqual([true, false, false]);
    expect(progress).toHaveBeenLastCalledWith(23, 23);
    expect(result).toMatchObject({ imported: 20, failed: 3, profile: 'savedOther' });
    if ('doneIds' in result) expect(result.doneIds).not.toContain(reading(1).id);
  });

  it('keeps a failed batch on the device and continues, but stops on age or session errors', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'E_CONFLICT' } })
      .mockResolvedValueOnce({
        ok: true,
        data: { results: [{ status: 'existing', readingId: 'x' }], profile: 'none' },
      });
    const result = await importInBatches(device(11), true, send, () => undefined);
    expect(result).toMatchObject({ imported: 1, failed: 10, doneIds: [reading(11).id] });
    const blocked = vi.fn().mockResolvedValue({ ok: false, error: { code: 'E_AGE_RESTRICTED' } });
    expect(await importInBatches(device(11), true, blocked, () => undefined)).toEqual({
      error: 'E_AGE_RESTRICTED',
    });
    expect(blocked).toHaveBeenCalledTimes(1);
  });

  it('sends a profile-only device once and treats duplicates as stored', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { results: [], profile: 'duplicate' } });
    const result = await importInBatches(device(0, true), false, send, () => undefined);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ saveProfile: false, readings: [] });
    expect(result).toMatchObject({ profile: 'duplicate' });
    expect(profileStored('duplicate')).toBe(true);
    expect(profileStored('skipped')).toBe(false);
  });
});
