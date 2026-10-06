import { isolatedSqlite } from '../../../scripts/sqlite-test';
import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from '../lib/db-encryption';
import { BirthInputSchema } from '@tianji/shared';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import { resolveBirth } from '../lib/reading-service';
const state = vi.hoisted(() => ({
  db: null as unknown,
  selected: undefined as string | undefined,
}));
vi.mock('../lib/db', () => ({ getDb: () => state.db }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (state.selected ? { value: state.selected } : undefined) }),
}));
import {
  saveProfile,
  currentProfile,
  ownedProfile,
  setDefaultProfile,
  removeProfile,
  profileBirth,
} from '../lib/profile-service';
const pg = isolatedSqlite();
let raw: PrismaClient;
let userId: string;
beforeAll(async () => {
  vi.stubEnv('FIELD_ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  raw = pg.client;
  state.db = raw.$extends(fieldEncryptionExtension());
});
beforeEach(async () => {
  state.selected = undefined;
  userId = (await raw.user.create({ data: {} })).id;
});
afterAll(async () => {
  await raw?.$disconnect();
  await pg.close();
  vi.unstubAllEnvs();
});
const birth = BirthInputSchema.parse(A);
const save = (label: string, id?: string) =>
  saveProfile(userId, birth, { label, relation: 'family' }, 'zh', id);
it('three live profiles can share version 1; labels remain encrypted and the fourth is rejected', async () => {
  const rows = await Promise.all([save('One'), save('Two'), save('Three')]);
  expect(await raw.birthProfile.count({ where: { userId, isCurrent: true } })).toBe(3);
  expect(await raw.birthProfile.count({ where: { userId, isDefault: true } })).toBe(1);
  expect(rows.every((r) => r.version === 1)).toBe(true);
  await expect(save('Fourth')).rejects.toMatchObject({ code: 'E_PROFILE_LIMIT' });
  const stored = await raw.birthProfile.findFirstOrThrow({ where: { userId } });
  expect(stored.label).toMatch(/^v1:/);
  expect(stored.encBirth).not.toContain('1990');
  const current = await currentProfile(userId);
  expect(['One', 'Two', 'Three']).toContain(current?.label);
  expect(profileBirth(current!)).toEqual(birth);
});
it('editing keeps identity and increments version, rejects foreign IDs and invalid metadata', async () => {
  const created = await save('Before');
  const edited = await save('After', created.profileId);
  expect(edited.profileId).toBe(created.profileId);
  expect(edited.version).toBe(2);
  expect(await raw.birthProfile.count({ where: { userId } })).toBe(1);
  await expect(save('No access', 'foreign')).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  await expect(
    saveProfile(userId, birth, { label: ' ', relation: 'friend' }, 'en'),
  ).rejects.toThrow();
  await expect(
    saveProfile(userId, birth, { label: 'New', relation: 'invalid' }, 'en'),
  ).rejects.toThrow();
});
it('current selection is owner-checked, falls back to default, and default changes are separate', async () => {
  const a = await save('First'),
    b = await save('Second');
  state.selected = b.profileId;
  expect((await currentProfile(userId))?.id).toBe(b.profileId);
  await setDefaultProfile(userId, a.profileId);
  expect((await currentProfile(userId))?.id).toBe(b.profileId);
  state.selected = 'foreign';
  expect((await currentProfile(userId))?.id).toBe(a.profileId);
  await expect(ownedProfile('another-user', a.profileId)).rejects.toMatchObject({
    code: 'E_FORBIDDEN',
  });
  await expect(setDefaultProfile(userId, 'missing')).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  await setDefaultProfile(userId, b.profileId);
  expect((await currentProfile(userId))?.id).toBe(b.profileId);
});
it('pro supports twenty profiles; downgrade preserves them while blocking additions', async () => {
  await raw.user.update({ where: { id: userId }, data: { plan: 'pro' } });
  for (let i = 0; i < 20; i++) await save(`Profile ${i}`);
  await expect(save('21')).rejects.toMatchObject({ code: 'E_PROFILE_LIMIT' });
  await raw.user.update({ where: { id: userId }, data: { plan: 'free' } });
  await expect(save('Still blocked')).rejects.toMatchObject({ code: 'E_PROFILE_LIMIT' });
  expect(await raw.birthProfile.count({ where: { userId } })).toBe(20);
});
it('deleting one profile cascades paired shares, retains the other and promotes a default', async () => {
  const a = await save('Alpha'),
    b = await save('Beta');
  await setDefaultProfile(userId, b.profileId);
  const reading = await raw.reading.create({
    data: {
      userId,
      profileId: a.profileId,
      partnerProfileId: b.profileId,
      system: 'synastry',
      encInput: 'encrypted-test-placeholder',
      chart: {},
      schoolUsed: {},
      engineVersion: '1.0.0',
      interpretVersion: '1',
      knowledgeVersion: '1',
    },
  });
  await raw.shareLink.create({
    data: { userId, readingId: reading.id, token: 'paired-test', template: 'synastry' },
  });
  await removeProfile(userId, b.profileId);
  expect(await raw.reading.count({ where: { id: reading.id } })).toBe(0);
  expect(await raw.shareLink.count({ where: { readingId: reading.id } })).toBe(0);
  expect((await currentProfile(userId))?.id).toBe(a.profileId);
  expect(await raw.birthProfile.count({ where: { userId } })).toBe(1);
  await expect(removeProfile(userId, 'missing')).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  await removeProfile(userId, a.profileId);
  expect(await currentProfile(userId)).toBeNull();
});
it('default uniqueness and deleted-account writes are enforced', async () => {
  const a = await save('First'),
    b = await save('Second');
  await expect(
    pg.query('UPDATE "BirthProfile" SET "isDefault" = true WHERE "id" = $1', [b.profileId]),
  ).rejects.toThrow();
  await raw.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  await expect(save('Blocked')).rejects.toMatchObject({ code: 'E_UNAUTHORIZED' });
  expect(await raw.birthProfile.count({ where: { userId, isDefault: true } })).toBe(1);
  expect(a.profileId).not.toBe(b.profileId);
});

it('paired input uses owned profiles and stamps both identities and the partner version', async () => {
  const a = await save('Alpha'),
    b = await save('Beta');
  const request = {
    system: 'synastry' as const,
    locale: 'zh' as const,
    partnerProfileId: b.profileId,
    idempotencyKey: crypto.randomUUID(),
  };
  const resolved = await resolveBirth(request, userId);
  expect(resolved.req).toMatchObject({
    profileId: a.profileId,
    partnerProfileId: b.profileId,
    partnerProfileVersion: 1,
    birth,
    partnerBirth: birth,
  });
  await save('Beta edited', b.profileId);
  expect((await resolveBirth(request, userId)).req.partnerProfileVersion).toBe(2);
  state.selected = b.profileId;
  await expect(resolveBirth(request, userId)).rejects.toMatchObject({ code: 'E_VALIDATION' });
  await expect(
    resolveBirth({ ...request, partnerProfileId: 'foreign' }, userId),
  ).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
});
it('every system associates the current profile while anonymous pairs require both inputs', async () => {
  const a = await save('Alpha'),
    b = await save('Beta');
  state.selected = b.profileId;
  for (const system of [
    'bazi',
    'ziwei',
    'astrology',
    'vedic',
    'numerology',
    'iching',
    'tarot',
    'qimen',
  ] as const) {
    const resolved = await resolveBirth(
      { system, locale: 'en', idempotencyKey: crypto.randomUUID() },
      userId,
    );
    expect(resolved.profile?.id).toBe(b.profileId);
  }
  const request = {
    system: 'synastry' as const,
    locale: 'zh' as const,
    birth,
    idempotencyKey: crypto.randomUUID(),
  };
  await expect(resolveBirth(request)).rejects.toMatchObject({ code: 'E_PROFILE_REQUIRED' });
  expect((await resolveBirth({ ...request, partnerBirth: birth })).req.partnerBirth).toEqual(birth);
  expect(a.profileId).not.toBe(b.profileId);
});
