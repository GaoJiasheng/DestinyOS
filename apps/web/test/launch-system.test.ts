import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BirthInput } from '@tianji/shared';

const mocks = vi.hoisted(() => ({
  readAnonymous: vi.fn(),
  updateAnonymous: vi.fn(),
  getProfileAction: vi.fn(),
  listReadingsAction: vi.fn(),
  getReadingBirthAction: vi.fn(),
  createReadingAction: vi.fn(),
  ensureConsent: vi.fn(),
}));
vi.mock('@/app/readings/actions', () => ({
  getProfileAction: mocks.getProfileAction,
  listReadingsAction: mocks.listReadingsAction,
  getReadingBirthAction: mocks.getReadingBirthAction,
  createReadingAction: mocks.createReadingAction,
}));
vi.mock('@/lib/anonymous-storage', () => ({
  readAnonymous: mocks.readAnonymous,
  updateAnonymous: mocks.updateAnonymous,
}));
vi.mock('@/lib/consent', () => ({ ensureConsent: mocks.ensureConsent }));

const { sameBirth, findExistingReading, findLaunchProfile, launchSystem } =
  await import('../lib/launch-system');

const me: BirthInput = {
  calendar: 'gregorian',
  year: 1990,
  month: 5,
  day: 12,
  hour: 8,
  minute: 30,
  timeUnknown: false,
  place: { name: 'Shanghai', lat: 31.23, lng: 121.47, tz: 'Asia/Shanghai' },
  gender: 'female',
};
const other: BirthInput = { ...me, day: 13 };

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getProfileAction.mockResolvedValue({ ok: true, data: null });
  mocks.readAnonymous.mockResolvedValue(null);
});

describe('one-click natal launch', () => {
  it('compares chart inputs and ignores the display-only place name', () => {
    expect(sameBirth(me, { ...me, place: { ...me.place!, name: '上海' } })).toBe(true);
    expect(sameBirth(me, other)).toBe(false);
    expect(sameBirth(me, { ...me, gender: 'male' })).toBe(false);
    expect(sameBirth(me, undefined)).toBe(false);
  });

  it('prefers the account profile and otherwise uses the device profile', async () => {
    mocks.readAnonymous.mockResolvedValue({ profile: other, readings: [] });
    expect(await findLaunchProfile()).toEqual({ birth: other });
    mocks.getProfileAction.mockResolvedValue({
      ok: true,
      data: { ...me, profileId: 'p1', label: 'Me', relation: 'self', version: 1, displayName: '' },
    });
    expect(await findLaunchProfile()).toEqual({ birth: me, profileId: 'p1' });
  });

  it('sends visitors without a profile to the form', async () => {
    expect(await launchSystem('bazi', 'zh')).toEqual({ href: '/bazi/new' });
    expect(mocks.createReadingAction).not.toHaveBeenCalled();
  });

  it('reopens the newest device report for the same person instead of generating another', async () => {
    mocks.readAnonymous.mockResolvedValue({
      profile: me,
      readings: [
        {
          id: 'old',
          system: 'bazi',
          createdAt: '2026-01-01T00:00:00.000Z',
          request: { birth: me },
        },
        {
          id: 'new',
          system: 'bazi',
          createdAt: '2026-02-01T00:00:00.000Z',
          request: { birth: me },
        },
        {
          id: 'friend',
          system: 'bazi',
          createdAt: '2026-03-01T00:00:00.000Z',
          request: { birth: other },
        },
        {
          id: 'zw',
          system: 'ziwei',
          createdAt: '2026-04-01T00:00:00.000Z',
          request: { birth: me },
        },
      ],
    });
    expect(await launchSystem('bazi', 'zh', { birth: me })).toEqual({ href: '/bazi/r/local/new' });
    expect(mocks.createReadingAction).not.toHaveBeenCalled();
  });

  it('matches account history by the stored birth snapshot', async () => {
    mocks.listReadingsAction.mockResolvedValue({
      ok: true,
      data: { items: [{ id: 'trial' }, { id: 'mine' }], nextCursor: null },
    });
    mocks.getReadingBirthAction.mockImplementation(async (id: string) => ({
      ok: true,
      data: id === 'trial' ? other : me,
    }));
    expect(await findExistingReading('astrology', { birth: me, profileId: 'p1' })).toBe(
      '/astrology/r/mine',
    );
    expect(mocks.listReadingsAction).toHaveBeenCalledWith({ system: 'astrology', limit: 5 });
  });

  it('creates a reading when none exists yet', async () => {
    mocks.listReadingsAction.mockResolvedValue({ ok: true, data: { items: [], nextCursor: null } });
    mocks.ensureConsent.mockResolvedValue(true);
    mocks.createReadingAction.mockResolvedValue({ ok: true, data: { readingId: 'r9' } });
    vi.useFakeTimers();
    const pending = launchSystem('vedic', 'en', { birth: me, profileId: 'p1' });
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ href: '/vedic/r/r9' });
    vi.useRealTimers();
    expect(mocks.createReadingAction).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'vedic', profileId: 'p1', birth: me }),
    );
  });
});
