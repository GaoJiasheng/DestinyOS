import { raw, db, request, stamp, metadata } from './mobile-fixture';
import { expect, it, vi } from 'vitest';
import { mobileApi } from '../lib/mobile/router';
import { issueSession } from '../lib/mobile/auth';
import { getSync, putSync } from '../lib/mobile/sync';
import { saveProfile, removeProfile } from '../lib/profile-service';
import { saveJournalEntry } from '../lib/journal-service';
import { chatOwner } from '../lib/chat-service';
import { softDeleteAccount, hardDeleteAccounts } from '../lib/account-service';
import { readExport, writeExport } from '../lib/platform/storage';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
it('syncs encrypted profiles, rejects cross-user IDs/stale edits, scopes cursors and observes Web edits/deletions', async () => {
  const session = await issueSession('owner', { deviceName: 'Phone', platform: 'ios' }),
    time = stamp();
  const put = await mobileApi(
    request(
      'sync/profiles',
      'PUT',
      {
        items: [
          {
            id: 'profile-local',
            updatedAt: time,
            deleted: false,
            birth: A,
            metadata,
            locale: 'zh',
          },
        ],
      },
      session.accessToken,
    ),
  );
  expect(put.status).toBe(200);
  const row = await raw.birthProfile.findUniqueOrThrow({ where: { id: 'profile-local' } });
  expect(row.encBirth).toMatch(/^v1:/);
  expect(row.label).not.toContain(metadata.label);
  const initial = await getSync('owner', 'profiles', new URLSearchParams());
  expect(initial.items).toHaveLength(1);
  const empty = await getSync('owner', 'profiles', new URLSearchParams({ since: initial.cursor }));
  expect(empty.items).toEqual([]);
  await expect(
    getSync('other', 'profiles', new URLSearchParams({ since: initial.cursor })),
  ).rejects.toMatchObject({ code: 'E_VALIDATION' });
  await expect(
    getSync('owner', 'journal', new URLSearchParams({ since: initial.cursor })),
  ).rejects.toMatchObject({ code: 'E_VALIDATION' });
  const stale = await putSync('owner', 'profiles', {
    items: [
      {
        id: row.id,
        updatedAt: stamp(-86400000),
        deleted: false,
        birth: A,
        metadata: { ...metadata, label: 'stale' },
      },
    ],
  });
  expect(JSON.stringify(stale)).toContain(metadata.label);
  expect(await raw.birthProfile.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
    version: 1,
  });
  await expect(
    putSync('other', 'profiles', {
      items: [{ id: row.id, updatedAt: stamp(2000), deleted: true }],
    }),
  ).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  await saveProfile('owner', A, { ...metadata, label: 'Web edit' }, 'zh', row.id);
  expect(
    JSON.stringify(
      await getSync('owner', 'profiles', new URLSearchParams({ since: initial.cursor })),
    ),
  ).toContain('Web edit');
  await removeProfile('owner', row.id);
  expect(
    (await getSync('owner', 'profiles', new URLSearchParams({ since: initial.cursor }))).items,
  ).toEqual([expect.objectContaining({ id: row.id, deleted: true })]);
  await putSync('owner', 'profiles', {
    items: [{ id: row.id, updatedAt: stamp(3000), deleted: false, birth: A, metadata }],
  });
  expect(await raw.birthProfile.findUnique({ where: { id: row.id } })).toBeNull();
});

it('syncs recomputed readings/journal/settings, paginates same-time changes, and emits cascade tombstones', async () => {
  await putSync('owner', 'profiles', {
    items: [{ id: 'profile', updatedAt: stamp(), deleted: false, birth: A, metadata }],
  });
  const createdAt = new Date().toISOString();
  const input = {
    items: [
      {
        id: 'reading',
        updatedAt: stamp(),
        deleted: false,
        createdAt,
        request: {
          system: 'numerology',
          birth: A,
          locale: 'zh',
          profileId: 'profile',
          idempotencyKey: crypto.randomUUID(),
        },
      },
    ],
  };
  await putSync('owner', 'readings', input);
  expect((await raw.reading.findUniqueOrThrow({ where: { id: 'reading' } })).encInput).toMatch(
    /^v1:/,
  );
  const reading = await getSync('owner', 'readings', new URLSearchParams());
  expect(JSON.stringify(reading)).toContain('knowledgeVersion');
  await putSync('owner', 'journal', {
    items: [
      {
        id: 'journal',
        updatedAt: stamp(),
        deleted: false,
        entry: {
          profileId: 'profile',
          date: '2026-10-01',
          mood: 4,
          text: 'Private diary',
          tz: 'UTC',
        },
      },
    ],
  });
  expect((await raw.journalEntry.findUniqueOrThrow({ where: { id: 'journal' } })).text).toMatch(
    /^v1:/,
  );
  const journals = await getSync('owner', 'journal', new URLSearchParams());
  expect(JSON.stringify(journals)).toContain('Private diary');
  await putSync('owner', 'settings', {
    items: [
      {
        id: 'owner',
        updatedAt: stamp(),
        deleted: false,
        settings: {
          locale: 'en',
          theme: 'vedic',
          dailyPushEnabled: false,
          dailyPushTime: '09:30',
          specialDayReminders: false,
          widgetTheme: 'west',
          hapticsOn: false,
        },
      },
    ],
  });
  expect(JSON.stringify(await getSync('owner', 'settings', new URLSearchParams()))).toContain(
    'vedic',
  );
  const settings = await db.user.findUniqueOrThrow({ where: { id: 'owner' } });
  expect(settings.theme).not.toBe('vedic');
  expect(settings.mobileSettings).toMatchObject({
    dailyPushEnabled: false,
    dailyPushTime: '09:30',
    widgetTheme: 'west',
    hapticsOn: false,
  });
  await expect(chatOwner('reading', 'other')).rejects.toMatchObject({ code: 'E_FORBIDDEN' });
  expect((await chatOwner('reading', 'owner')).user.id).toBe('owner');
  await saveJournalEntry(
    'owner',
    { profileId: 'profile', date: '2026-10-01', mood: 5, text: 'Web diary', tz: 'UTC' },
    'zh',
  );
  expect(
    JSON.stringify(
      await getSync('owner', 'journal', new URLSearchParams({ since: journals.cursor })),
    ),
  ).toContain('Web diary');
  await removeProfile('owner', 'profile');
  expect(
    (await getSync('owner', 'readings', new URLSearchParams({ since: reading.cursor }))).items,
  ).toEqual([expect.objectContaining({ id: 'reading', deleted: true })]);
  expect(
    (await getSync('owner', 'journal', new URLSearchParams({ since: journals.cursor }))).items,
  ).toEqual([expect.objectContaining({ id: 'journal', deleted: true })]);
  await putSync('owner', 'readings', {
    items: Array.from({ length: 4 }, (_, i) => ({
      id: `missing-${i}`,
      updatedAt: stamp(),
      deleted: true,
    })),
  });
  let cursor = '0';
  const ids = new Set<string>();
  let more = true;
  while (more) {
    const page = await getSync(
      'owner',
      'readings',
      new URLSearchParams({ since: cursor, limit: '1' }),
    );
    page.items.forEach((item) => ids.add(item.id));
    cursor = page.cursor;
    more = page.hasMore;
  }
  expect(ids.size).toBe(5);
});

it('reuses private exports, shares and entitlement sync; revoked access cannot download cached exports', async () => {
  const session = await issueSession('owner', { deviceName: 'Phone', platform: 'ios' });
  await putSync('owner', 'readings', {
    items: [
      {
        id: 'reading',
        updatedAt: stamp(),
        deleted: false,
        createdAt: new Date().toISOString(),
        request: {
          system: 'numerology',
          birth: A,
          locale: 'zh',
          idempotencyKey: crypto.randomUUID(),
        },
      },
    ],
  });
  await raw.user.update({ where: { id: 'owner' }, data: { plan: 'pro' } });
  const cache = new Map<string, Uint8Array>();
  vi.mocked(readExport).mockImplementation(async (key) => cache.get(key) ?? null);
  vi.mocked(writeExport).mockImplementation(async (key, bytes) => {
    cache.set(key, bytes);
  });
  const response = await mobileApi(
    request('export/reading', 'POST', { format: 'pdf', locale: 'zh' }, session.accessToken),
  );
  expect(response.status).toBe(200);
  const result = (await response.json()) as { data: { url: string } };
  const download = new Request(new URL(result.data.url, 'https://tianji.gavin.pub'), {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect((await mobileApi(download)).headers.get('Content-Type')).toBe('application/pdf');
  expect((await mobileApi(new Request(download.url))).status).toBe(401);
  const share = await mobileApi(
    request('share/reading', 'POST', { template: 'quote' }, session.accessToken),
  );
  expect(share.status).toBe(200);
  const link = await raw.shareLink.findFirstOrThrow({ where: { userId: 'owner' } });
  expect(link.revealLevel).toBe(0);
  expect(
    (await mobileApi(request('entitlements/sync', 'POST', {}, session.accessToken))).status,
  ).toBe(200);
  const foreign = await issueSession('other', { deviceName: 'Other', platform: 'android' });
  expect(
    (await mobileApi(request('share/reading', 'POST', { template: 'quote' }, foreign.accessToken)))
      .status,
  ).toBe(403);
  await softDeleteAccount('owner');
  expect((await mobileApi(download)).status).toBe(401);
  expect(await raw.mobileSession.count({ where: { userId: 'owner' } })).toBe(0);
  await hardDeleteAccounts(new Date(Date.now() + 8 * 86400000));
  expect(await raw.user.findUnique({ where: { id: 'owner' } })).toBeNull();
});
it('syncs a new default without invalidating either birth version', async () => {
  const first = await saveProfile('owner', A, { label: 'A', relation: 'self' }, 'en');
  const second = await saveProfile('owner', A, { label: 'B', relation: 'partner' }, 'en');
  await putSync('owner', 'profiles', {
    items: [
      {
        id: second.profileId,
        updatedAt: stamp(2000),
        deleted: false,
        birth: A,
        metadata: { label: 'B', relation: 'partner' },
        isDefault: true,
        locale: 'en',
      },
    ],
  });
  expect(
    await raw.birthProfile.findUniqueOrThrow({ where: { id: first.profileId } }),
  ).toMatchObject({ version: 1, isDefault: false });
  expect(
    await raw.birthProfile.findUniqueOrThrow({ where: { id: second.profileId } }),
  ).toMatchObject({ version: 1, isDefault: true });
});
