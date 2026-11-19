import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  userUpdate: vi.fn(),
  persist: vi.fn(),
  save: vi.fn(),
  profileBirth: vi.fn(),
  state: new Map<string, string>(),
  reserve: vi.fn(),
}));
vi.mock('../lib/db', () => ({
  getDb: () => ({
    reading: { findFirst: m.findFirst },
    birthProfile: { findMany: m.findMany },
    user: { update: m.userUpdate },
  }),
}));
vi.mock('../lib/state', () => ({
  stateReserve: m.reserve,
  stateRelease: vi.fn(async () => true),
  stateRead: vi.fn(async (key: string) => m.state.get(key) ?? null),
  stateWrite: vi.fn(async (key: string, value: string) => void m.state.set(key, value)),
}));
vi.mock('../lib/reading-service', async (original) => ({
  ...(await original<typeof import('../lib/reading-service')>()),
  persistReading: m.persist,
}));
vi.mock('../lib/profile-service', () => ({ saveProfile: m.save, profileBirth: m.profileBirth }));
vi.mock('../lib/reading-schema', async (original) => ({
  ...(await original<typeof import('../lib/reading-schema')>()),
  parseReadingChart: vi.fn(),
}));
const { importAnonymousBatch, IMPORT_HOURLY_LIMIT } = await import('../lib/reading-import');

const birth = {
  calendar: 'gregorian',
  year: 1990,
  month: 6,
  day: 15,
  hour: 9,
  minute: 5,
  timeUnknown: false,
  gender: 'female',
} as const;
const local = (n: number, createdAt = '2025-01-02T03:04:05.000Z') => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  request: {
    system: 'tarot',
    locale: 'zh',
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
  },
  chart: {},
  meta: { schoolUsed: {}, warnings: [] },
  createdAt,
});
const labels = async () => ({ self: '自己', other: '其他' });
const anonId = '00000000-0000-4000-8000-0000000000aa';
beforeEach(() => {
  vi.clearAllMocks();
  m.state.clear();
  m.reserve.mockResolvedValue(true);
  m.findFirst.mockResolvedValue(null);
  m.findMany.mockResolvedValue([]);
  m.persist.mockResolvedValue({});
});

describe('importAnonymousBatch', () => {
  it('imports item by item, keeps the original time, and skips damaged or existing items', async () => {
    m.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'already' });
    const result = await importAnonymousBatch(
      'owner',
      { anonId, readings: [local(1), { id: 'bad' }, local(2)] },
      labels,
    );
    expect(result.results.map((r) => r.status)).toEqual(['imported', 'failed', 'existing']);
    expect(m.persist).toHaveBeenCalledTimes(1);
    const call = m.persist.mock.calls[0]!;
    expect(call[2]).toBe('2025-01-02T03:04:05.000Z');
    expect(call[8]).toBe(true);
    // FEATURE_EMPHASIS is unset in tests, so the import recomputation passes the switch off.
    expect(call[9]).toBe(false);
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: 'owner' }, data: { anonId } });
  });

  it('does not use the reading quota but stops at its own hourly ceiling', async () => {
    m.state.set(
      `import:count:${(await import('../lib/reading-service')).digest('owner')}`,
      JSON.stringify({ count: IMPORT_HOURLY_LIMIT - 1, since: Date.now() }),
    );
    const result = await importAnonymousBatch(
      'owner',
      { anonId, readings: [local(1), local(2)] },
      labels,
    );
    expect(result.results).toEqual([
      expect.objectContaining({ status: 'imported' }),
      { status: 'failed', code: 'E_RATE_LIMITED' },
    ]);
  });

  it('rejects a concurrent import for the same account', async () => {
    m.reserve.mockResolvedValue(false);
    await expect(
      importAnonymousBatch('owner', { anonId, readings: [local(1)] }, labels),
    ).rejects.toMatchObject({ code: 'E_CONFLICT' });
    expect(m.persist).not.toHaveBeenCalled();
  });

  it('keeps an account profile and adds the device person as "other", or skips an identical one', async () => {
    m.findMany.mockResolvedValue([{ id: 'p1' }]);
    m.profileBirth.mockReturnValue({ ...birth, year: 1980 });
    expect(
      (await importAnonymousBatch('owner', { anonId, profile: birth, readings: [] }, labels))
        .profile,
    ).toBe('savedOther');
    expect(m.save).toHaveBeenCalledWith('owner', birth, { label: '其他', relation: 'other' }, 'zh');
    m.save.mockClear();
    m.profileBirth.mockReturnValue(birth);
    expect(
      (await importAnonymousBatch('owner', { anonId, profile: birth, readings: [] }, labels))
        .profile,
    ).toBe('duplicate');
    m.profileBirth.mockReturnValue({ ...birth, year: 1980 });
    expect(
      (
        await importAnonymousBatch(
          'owner',
          { anonId, profile: birth, saveProfile: false, readings: [] },
          labels,
        )
      ).profile,
    ).toBe('skipped');
    expect(m.save).not.toHaveBeenCalled();
  });

  it('imports a reading the device marked as someone else even under 13', async () => {
    m.reserve.mockResolvedValue(true);
    m.findMany.mockResolvedValue([]);
    m.findFirst.mockResolvedValue(null);
    const item = local(1);
    const marked = {
      ...item,
      request: { ...item.request, birth: { ...birth, year: 2020 }, subject: 'other' },
    };
    const result = await importAnonymousBatch('owner', { anonId, readings: [marked] }, labels);
    expect(result.results[0]).toMatchObject({ status: 'imported' });
    expect(m.persist).toHaveBeenCalledOnce();
  });

  it('treats an older under-13 snapshot without a mark as the user and rejects the batch', async () => {
    const item = local(1);
    const legacy = { ...item, request: { ...item.request, birth: { ...birth, year: 2020 } } };
    await expect(
      importAnonymousBatch('owner', { anonId, readings: [legacy] }, labels),
    ).rejects.toMatchObject({ code: 'E_AGE_RESTRICTED' });
    // The device profile is always the user, whatever its readings say.
    await expect(
      importAnonymousBatch(
        'owner',
        {
          anonId,
          profile: { ...birth, year: 2020 },
          readings: [{ ...legacy, request: { ...legacy.request, subject: 'other' } }],
        },
        labels,
      ),
    ).rejects.toMatchObject({ code: 'E_AGE_RESTRICTED' });
    expect(m.persist).not.toHaveBeenCalled();
  });

  it('still rejects the whole batch for an under-age birth', async () => {
    await expect(
      importAnonymousBatch(
        'owner',
        { anonId, profile: { ...birth, year: 2020 }, readings: [local(1)] },
        labels,
      ),
    ).rejects.toMatchObject({ code: 'E_AGE_RESTRICTED' });
    expect(m.persist).not.toHaveBeenCalled();
  });
});
