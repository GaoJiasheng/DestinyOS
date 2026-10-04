import { it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  create: vi.fn(),
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
  getReadingAction,
  renameReadingAction,
  deleteReadingAction,
  createReadingAction,
  importAnonymousDataAction,
} from '../app/readings/actions';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.getCookie.mockReturnValue(undefined);
  mocks.find.mockResolvedValue({ id: 'private', userId: 'other', isPublic: false });
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.deleteMany.mockResolvedValue({ count: 0 });
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
