import { beforeEach, it, expect, vi } from 'vitest';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  auth: vi.fn(),
  rate: vi.fn(),
  user: vi.fn(),
  daily: vi.fn(),
}));
vi.mock('../lib/db', () => ({
  getDb: () => ({
    birthProfile: { findFirst: mocks.profile },
    user: { findUniqueOrThrow: mocks.user },
  }),
}));
vi.mock('../lib/redis', () => ({
  getLocalRedis: () => ({ get: mocks.get, set: mocks.set }),
  getUpstashRedis: () => ({ get: mocks.get, set: mocks.set }),
}));
vi.mock('../lib/auth', () => ({ auth: mocks.auth }));
vi.mock('../lib/ratelimit', async (original) => ({
  ...(await original<typeof import('../lib/ratelimit')>()),
  ratelimit: mocks.rate,
}));
vi.mock('../lib/daily-service', () => ({ dailyForUser: mocks.daily }));
vi.mock('../lib/events', () => ({ recordEvent: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
import { calendarYearForUser, dailyRangeForUser } from '../lib/calendar-service';
import { getDailyRangeAction, getCalendarYearAction, getDailyAction } from '../app/today/actions';
const birth = BirthInputSchema.parse(A),
  { place, gender, ...input } = birth;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  mocks.profile.mockResolvedValue({
    id: 'profile-one',
    version: 1,
    encBirth: JSON.stringify(input),
    encPlace: JSON.stringify(place),
    gender,
    tz: place?.tz,
  });
  mocks.auth.mockResolvedValue({ user: { id: 'owner' } });
  mocks.rate.mockResolvedValue({ success: true });
  mocks.get.mockResolvedValue(null);
  mocks.user.mockResolvedValue({ id: 'owner', tz: 'Asia/Shanghai', locale: 'zh', plan: 'free' });
});
it('monthly service reads only the owner and computes within 400ms', async () => {
  const start = performance.now();
  const days = await dailyRangeForUser('owner', '2026-10-01', '2026-10-31', 'Asia/Shanghai', 'zh');
  expect(days).toHaveLength(31);
  expect(performance.now() - start).toBeLessThanOrEqual(400);
  expect(mocks.profile).toHaveBeenCalledWith({
    where: { userId: 'owner', isCurrent: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
});
it('annual cache isolates owner, version, year, zone and locale, and tolerates malformed cache', async () => {
  const a = await calendarYearForUser('owner', 2026, 'Asia/Shanghai', 'zh');
  const key = mocks.set.mock.calls[0]![0] as string;
  expect(key).toMatch(/^calendar:owner:profile-one:1:2026:Asia%2FShanghai:zh:/);
  expect(mocks.set.mock.calls[0]!.slice(2)).toEqual(['EX', 86400]);
  mocks.get.mockResolvedValue(JSON.stringify(a));
  expect(await calendarYearForUser('owner', 2026, 'Asia/Shanghai', 'zh')).toEqual(a);
  expect(mocks.set).toHaveBeenCalledTimes(1);
  for (const cached of ['invalid JSON', JSON.stringify([{ kind: 'wrong' }])]) {
    mocks.get.mockResolvedValue(cached);
    await calendarYearForUser('other', 2027, 'UTC', 'en');
  }
  expect(mocks.get.mock.calls.at(-1)?.[0]).toMatch(/^calendar:other:profile-one:1:2027:UTC:en:/);
  mocks.profile.mockResolvedValue({
    id: 'profile-one',
    version: 2,
    encBirth: JSON.stringify(input),
    encPlace: JSON.stringify(place),
    gender,
  });
  await calendarYearForUser('owner', 2026, 'UTC', 'en');
  expect(mocks.set.mock.calls.at(-1)?.[0]).toMatch(/^calendar:owner:profile-one:2:2026:UTC:en:/);
});
it('supports Upstash structured cache and rejects absent profiles', async () => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://cache.example');
  const events = await calendarYearForUser('owner', 2026, 'UTC', 'en');
  expect(mocks.set.mock.calls.at(-1)?.[2]).toEqual({ ex: 86400 });
  mocks.get.mockResolvedValue(events);
  expect(await calendarYearForUser('owner', 2026, 'UTC', 'en')).toEqual(events);
  mocks.profile.mockResolvedValue(null);
  await expect(calendarYearForUser('owner', 2026, 'UTC', 'en')).rejects.toMatchObject({
    code: 'E_PROFILE_REQUIRED',
  });
});
it('actions reject anonymous access and forged user input', async () => {
  mocks.auth.mockResolvedValue(null);
  expect(
    await getDailyRangeAction({ from: '2026-10-01', to: '2026-10-31', tz: 'UTC' }),
  ).toMatchObject({ ok: false, error: { code: 'E_UNAUTHORIZED' } });
  expect(await getCalendarYearAction({ year: 2026, tz: 'UTC' })).toMatchObject({
    ok: false,
    error: { code: 'E_UNAUTHORIZED' },
  });
  expect(
    await getDailyRangeAction({
      from: '2026-10-01',
      to: '2026-10-31',
      tz: 'UTC',
      userId: 'victim',
    }),
  ).toMatchObject({ ok: false, error: { code: 'E_VALIDATION' } });
  expect(mocks.profile).not.toHaveBeenCalled();
});
it('actions enforce 31-day maximum, valid years, missing profile and rate limits', async () => {
  expect(
    await getDailyRangeAction({ from: '2026-10-01', to: '2026-11-01', tz: 'UTC' }),
  ).toMatchObject({ ok: false, error: { code: 'E_INVALID_INPUT' } });
  expect(await getCalendarYearAction({ year: 2101, tz: 'UTC' })).toMatchObject({
    ok: false,
    error: { code: 'E_VALIDATION' },
  });
  mocks.profile.mockResolvedValue(null);
  expect(
    await getDailyRangeAction({ from: '2026-10-01', to: '2026-10-31', tz: 'UTC' }),
  ).toMatchObject({ ok: false, error: { code: 'E_PROFILE_REQUIRED' } });
  mocks.rate.mockResolvedValue({ success: false, reset: Date.now() + 3600000 });
  expect(await getCalendarYearAction({ year: 2026, tz: 'UTC' })).toMatchObject({
    ok: false,
    error: { code: 'E_RATE_LIMITED' },
  });
});
it('calendar dates reuse getDailyAction for dates beyond yesterday and tomorrow', async () => {
  mocks.daily.mockResolvedValue({ chart: { date: { local: '2027-08-12' } } });
  expect(await getDailyAction({ date: '2027-08-12', tz: 'UTC', locale: 'en' })).toMatchObject({
    ok: true,
  });
  expect(mocks.daily).toHaveBeenCalledWith('owner', '2027-08-12', 'UTC', 'en');
  expect(await getDailyAction({ date: '2101-01-01', tz: 'UTC' })).toMatchObject({
    ok: false,
    error: { code: 'E_DATE_OUT_OF_RANGE' },
  });
  expect(await getDailyAction({ date: '2026-02-30', tz: 'UTC' })).toMatchObject({
    ok: false,
    error: { code: 'E_VALIDATION' },
  });
});

it('zh-TW calendar actions compute scores and retain a separate annual cache', async () => {
  const days = await getDailyRangeAction({
    from: '2026-10-01',
    to: '2026-10-31',
    tz: 'Asia/Shanghai',
    locale: 'zh-TW',
  });
  expect(days).toMatchObject({ ok: true });
  if (!days.ok) throw new Error(days.error.code);
  expect(days.data).toEqual(
    await dailyRangeForUser('owner', '2026-10-01', '2026-10-31', 'Asia/Shanghai', 'zh'),
  );
  const annual = await getCalendarYearAction({ year: 2026, tz: 'Asia/Shanghai', locale: 'zh-TW' });
  expect(annual).toMatchObject({ ok: true });
  expect(mocks.set.mock.calls.at(-1)?.[0]).toMatch(
    /^calendar:owner:profile-one:1:2026:Asia%2FShanghai:zh-TW:/,
  );
  mocks.daily.mockResolvedValue({ chart: { date: { local: '2026-10-01' } } });
  expect(
    await getDailyAction({ date: '2026-10-01', tz: 'Asia/Shanghai', locale: 'zh-TW' }),
  ).toMatchObject({ ok: true });
  expect(mocks.daily).toHaveBeenCalledWith('owner', '2026-10-01', 'Asia/Shanghai', 'zh-TW');
});
