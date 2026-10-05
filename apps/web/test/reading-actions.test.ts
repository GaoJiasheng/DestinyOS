import { it, expect, vi, beforeEach } from 'vitest';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { BirthInputSchema, AstroChartSchema } from '@tianji/shared';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  create: vi.fn(),
  rate: vi.fn(),
}));
vi.mock('../lib/ratelimit', async (original) => ({
  ...(await original<typeof import('../lib/ratelimit')>()),
  ratelimit: mocks.rate,
}));
vi.mock('../lib/auth', () => ({ auth: mocks.auth }));
vi.mock('../lib/db', () => ({
  getDb: () => ({
    reading: {
      findUnique: mocks.find,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
      create: mocks.create,
    },
  }),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mocks.getCookie, set: mocks.setCookie }),
  headers: async () => new Headers(),
}));
import {
  previewAstrologyHousesAction,
  getReadingAction,
  renameReadingAction,
  deleteReadingAction,
  createReadingAction,
  importAnonymousDataAction,
  regenerateReportAction,
  translateAnonymousReportAction,
} from '../app/readings/actions';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.getCookie.mockReturnValue(undefined);
  mocks.find.mockResolvedValue({ id: 'private', userId: 'other', isPublic: false });
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.deleteMany.mockResolvedValue({ count: 0 });
});
it('filters by the authenticated owner before reading/decrypting a report or preview snapshot', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'intruder', plan: 'free' } });
  mocks.findFirst.mockResolvedValue(null);
  expect(await getReadingAction('private')).toEqual({ ok: false, error: { code: 'E_FORBIDDEN' } });
  expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: 'private', userId: 'intruder' } });
  expect(mocks.find).not.toHaveBeenCalled();
});

it('applies the report quota to regeneration and anonymous translation before interpretation', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'owner', plan: 'free' } });
  mocks.findFirst.mockResolvedValue({ id: 'private', userId: 'owner', encInput: 'invalid' });
  mocks.rate.mockResolvedValue({ success: false, reset: Date.now() + 3600000 });
  expect(await regenerateReportAction('private', 'en')).toEqual({
    ok: false,
    error: { code: 'E_RATE_LIMITED' },
  });
  expect(mocks.rate).toHaveBeenCalledWith('reading.free', 'owner');
  mocks.auth.mockResolvedValue(null);
  mocks.rate.mockResolvedValue({ success: true });
  const request = {
    system: 'astrology' as const,
    locale: 'en' as const,
    birth: BirthInputSchema.parse(A),
    idempotencyKey: crypto.randomUUID(),
  };
  const preview = await previewAstrologyHousesAction({
    request,
    createdAt: '2026-10-04T12:00:00Z',
    locale: 'en',
    houseSystem: 'equal',
  });
  if (!preview.ok) throw new Error(preview.error.code);
  mocks.rate.mockResolvedValue({ success: false, reset: Date.now() + 3600000 });
  expect(
    await translateAnonymousReportAction(
      { ...preview.data, system: 'astrology', request, createdAt: '2026-10-04T12:00:00Z' },
      'en',
    ),
  ).toEqual({ ok: false, error: { code: 'E_RATE_LIMITED' } });
  expect(mocks.create).not.toHaveBeenCalled();
});
it('rejects anonymous reads and all mutations on private owner reports', async () => {
  expect(await getReadingAction('private')).toEqual({ ok: false, error: { code: 'E_FORBIDDEN' } });
  expect(await renameReadingAction('private', 'new')).toEqual({
    ok: false,
    error: { code: 'E_UNAUTHORIZED' },
  });
  expect(await deleteReadingAction('private')).toEqual({
    ok: false,
    error: { code: 'E_UNAUTHORIZED' },
  });
  mocks.auth.mockResolvedValue({ user: { id: 'intruder' } });
  expect(await renameReadingAction('private', 'new')).toEqual({
    ok: false,
    error: { code: 'E_FORBIDDEN' },
  });
  expect(await deleteReadingAction('private')).toEqual({
    ok: false,
    error: { code: 'E_FORBIDDEN' },
  });
});
it('sets the HttpOnly session age gate and never authenticates or writes underage input', async () => {
  const result = await createReadingAction({
    system: 'bazi',
    locale: 'zh',
    idempotencyKey: crypto.randomUUID(),
    birth: {
      calendar: 'gregorian',
      year: 2020,
      month: 1,
      day: 1,
      timeUnknown: true,
      gender: 'unspecified',
    },
  });
  expect(result).toEqual({ ok: false, error: { code: 'E_AGE_RESTRICTED' } });
  expect(mocks.setCookie).toHaveBeenCalledWith(
    'age_gate',
    'blocked',
    expect.objectContaining({ httpOnly: true, path: '/', sameSite: 'lax' }),
  );
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it('rejects oversized imports and invalid chart snapshots before writes', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'owner' } });
  const req = { system: 'bazi', locale: 'zh', idempotencyKey: crypto.randomUUID() };
  const reading = {
    id: crypto.randomUUID(),
    request: req,
    createdAt: new Date().toISOString(),
    chart: {},
    meta: { schoolUsed: {}, warnings: [] },
  };
  expect(
    await importAnonymousDataAction({ anonId: crypto.randomUUID(), readings: [reading] }),
  ).toEqual({ ok: false, error: { code: 'E_VALIDATION' } });
  expect(
    await importAnonymousDataAction({
      anonId: crypto.randomUUID(),
      readings: Array.from({ length: 51 }, () => reading),
    }),
  ).toEqual({ ok: false, error: { code: 'E_VALIDATION' } });
  expect(mocks.create).not.toHaveBeenCalled();
});
it('blocks valid requests if the session already knows the visitor is under thirteen', async () => {
  mocks.getCookie.mockReturnValue({ value: 'blocked' });
  expect(await createReadingAction({})).toEqual({ ok: false, error: { code: 'E_AGE_RESTRICTED' } });
  expect(mocks.auth).not.toHaveBeenCalled();
});

it('house previews enforce private reading access and reject undocumented systems or mixed input', async () => {
  expect(
    await previewAstrologyHousesAction({
      readingId: 'private',
      locale: 'en',
      houseSystem: 'equal',
    }),
  ).toEqual({ ok: false, error: { code: 'E_FORBIDDEN' } });
  expect(
    await previewAstrologyHousesAction({ readingId: 'private', locale: 'en', houseSystem: 'koch' }),
  ).toEqual({ ok: false, error: { code: 'E_VALIDATION' } });
  expect(
    await previewAstrologyHousesAction({
      readingId: 'private',
      request: { system: 'astrology', locale: 'en', idempotencyKey: crypto.randomUUID() },
      locale: 'en',
      houseSystem: 'equal',
    }),
  ).toEqual({ ok: false, error: { code: 'E_VALIDATION' } });
  expect(mocks.create).not.toHaveBeenCalled();
});

it('recomputes anonymous chart, interpretation and school metadata together without persisting', async () => {
  const result = await previewAstrologyHousesAction({
    request: {
      system: 'astrology',
      locale: 'en',
      birth: BirthInputSchema.parse(A),
      idempotencyKey: crypto.randomUUID(),
    },
    createdAt: '2026-10-04T12:00:00Z',
    locale: 'en',
    houseSystem: 'equal',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  const chart = AstroChartSchema.parse(result.data.chart);
  expect(chart.houseSystem).toBe('equal');
  expect(result.data.meta.schoolUsed.houseSystem).toBe('equal');
  expect(result.data.report.sections).toHaveLength(9);
  expect(chart.houses?.[1]?.cusp).toBeCloseTo((chart.angles!.asc + 30) % 360);
  expect(mocks.create).not.toHaveBeenCalled();
});
