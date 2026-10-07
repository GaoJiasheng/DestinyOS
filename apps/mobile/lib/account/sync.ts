import * as Crypto from 'expo-crypto';
import {
  mobilePullEndpoint,
  mobilePushEndpoint,
  mobileResources,
  type MobileResource,
  type MobileSyncItem,
} from '@tianji/api-client';
import { getCopy } from '../copy';
import type { MobileLocale } from '../i18n';
import { createLocalStore, getLocalStore } from '../data/store';
import { SettingsSchema } from '../data/models';
import type { SessionManager } from './session';
type Store = Awaited<ReturnType<typeof getLocalStore>>;
const repositories = (store: Store) => ({
  profiles: store.profiles,
  readings: store.readings,
  journal: store.journal,
  settings: store.settings,
});
/** Count live anonymous data before asking for explicit upload consent. */
export async function anonymousCount(store: Store) {
  const [profiles, readings, journal, settings] = await Promise.all([
    store.profiles.list(500),
    store.readings.list(500),
    store.journal.list(500),
    store.settings.list(1),
  ]);
  const defaults = SettingsSchema.parse({});
  const preferences = settings[0]?.data;
  // DESIGN-GAP: Device onboarding/selection acknowledgement alone is not anonymous content to upload.
  const settingsCount =
    preferences &&
    [
      'locale',
      'theme',
      'soundOn',
      'reducedMotion',
      'tz',
      'dailyPushEnabled',
      'dailyPushTime',
      'specialDayReminders',
      'widgetTheme',
      'hapticsOn',
    ].some(
      (key) =>
        preferences[key as keyof typeof preferences] !== defaults[key as keyof typeof defaults],
    )
      ? 1
      : 0;
  return profiles.length + readings.length + journal.length + settingsCount;
}
/** Confirmed import rekeys anonymous identities atomically; retry cannot import the same records twice. */
export async function mergeAnonymous(anonymous: Store, userId: string) {
  const account = createLocalStore(anonymous.database, userId);
  await anonymous.database.write(async (sql) => {
    const rows = await sql.getAllAsync<{
      id: string;
      entity: string;
      data: string;
      createdAt: string;
      updatedAt: string;
    }>(
      "SELECT id,'profiles' entity,data,createdAt,updatedAt FROM BirthProfile WHERE userId IS NULL AND deletedAt IS NULL",
    );
    const ids = new Map(rows.map((row) => [row.id, Crypto.randomUUID()]));
    for (const row of rows) {
      const value = JSON.parse(row.data) as Record<string, unknown>;
      await account.profiles.saveInTransaction(sql, value, ids.get(row.id));
    }
    for (const [table, repo] of [
      ['Reading', account.readings],
      ['JournalEntry', account.journal],
    ] as const) {
      const records = await sql.getAllAsync<{ data: string }>(
        `SELECT data FROM "${table}" WHERE userId IS NULL AND deletedAt IS NULL`,
      );
      for (const row of records) {
        const value = JSON.parse(row.data) as Record<string, unknown>;
        const profileId =
          typeof value.profileId === 'string' ? (ids.get(value.profileId) ?? null) : null;
        const input = value.inputSnapshot;
        const snapshot = input && typeof input === 'object' ? { ...input } : undefined;
        if (snapshot) {
          const parsed = snapshot as Record<string, unknown>;
          for (const field of ['profileId', 'partnerProfileId'])
            if (typeof parsed[field] === 'string')
              parsed[field] = ids.get(parsed[field]) ?? undefined;
        }
        await repo.saveInTransaction(sql, {
          ...value,
          profileId,
          ...(snapshot ? { inputSnapshot: snapshot } : {}),
          ...(table === 'Reading' ? { profileVersion: profileId ? 1 : null } : {}),
        });
      }
    }
    const settings = await sql.getFirstAsync<{ data: string }>(
      'SELECT data FROM Settings WHERE userId IS NULL AND deletedAt IS NULL',
    );
    const preferences = SettingsSchema.parse(settings ? JSON.parse(settings.data) : {});
    const existing = await sql.getFirstAsync<{ id: string }>(
      'SELECT id FROM Settings WHERE userId=?',
      userId,
    );
    await account.settings.saveInTransaction(
      sql,
      {
        ...preferences,
        activeProfileId: preferences.activeProfileId
          ? (ids.get(preferences.activeProfileId) ?? null)
          : null,
        onboardingVersion: 1,
      },
      existing?.id,
    );
    // DESIGN-GAP: Retire confirmed anonymous records after the encrypted account copy commits; queued uploads survive offline failures.
    await sql.execAsync(
      'DELETE FROM BirthProfileVersion WHERE profileId IN (SELECT id FROM BirthProfile WHERE userId IS NULL)',
    );
    await sql.execAsync(
      'DELETE FROM ReportFeedback WHERE readingId IN (SELECT id FROM Reading WHERE userId IS NULL)',
    );
    for (const table of ['JournalEntry', 'Reading', 'BirthProfile', 'Settings'])
      await sql.execAsync(`DELETE FROM "${table}" WHERE userId IS NULL`);
    // DESIGN-GAP: Retain non-personal device acknowledgement so logout/revocation never repeats onboarding or loses the age gate.
    await anonymous.settings.saveInTransaction(
      sql,
      SettingsSchema.parse({
        onboardingVersion: preferences.onboardingVersion,
        ageBlocked: preferences.ageBlocked,
        locale: preferences.locale,
        theme: preferences.theme,
        dailyNotificationHintDismissed: preferences.dailyNotificationHintDismissed,
      }),
    );
  });
}
function upload(
  resource: MobileResource,
  record:
    | Awaited<ReturnType<Store['profiles']['changes']>>[number]
    | Awaited<ReturnType<Store['readings']['changes']>>[number]
    | Awaited<ReturnType<Store['journal']['changes']>>[number]
    | Awaited<ReturnType<Store['settings']['changes']>>[number],
  userId: string,
  locale: MobileLocale,
) {
  const base = {
    id: resource === 'settings' ? userId : record.id,
    updatedAt: record.updatedAt,
    deleted: record.deletedAt !== null,
  };
  if (!record.data) return base;
  const data = record.data;
  if (resource === 'profiles' && 'birth' in data)
    return {
      ...base,
      birth: data.birth,
      isDefault: data.isDefault,
      metadata: {
        label: data.name || getCopy(locale)('mobile.profiles.unnamed'),
        relation: data.relation ?? 'self',
      },
      locale,
    };
  if (resource === 'readings' && 'inputSnapshot' in data)
    return {
      ...base,
      request: data.inputSnapshot,
      createdAt: record.createdAt,
      title: data.title?.slice(0, 120) ?? null,
    };
  if (resource === 'journal' && 'prediction' in data)
    return {
      ...base,
      entry: {
        profileId: data.profileId,
        date: data.date,
        mood: data.mood,
        text: data.text,
        tz: data.tz,
      },
      locale,
    };
  if (resource === 'settings' && 'theme' in data) {
    const settings = {
      locale: data.locale,
      soundOn: data.soundOn,
      reducedMotion: data.reducedMotion,
      tz: data.tz,
      theme: data.theme,
      dailyPushEnabled: data.dailyPushEnabled,
      dailyPushTime: data.dailyPushTime,
      specialDayReminders: data.specialDayReminders,
      widgetTheme: data.widgetTheme,
      hapticsOn: data.hapticsOn,
    };
    return { ...base, settings };
  }
  throw new Error('E_VALIDATION');
}
/** Translate authoritative Web payloads to encrypted native snapshots without recomputing reports. */
export async function applyItems(store: Store, resource: MobileResource, items: MobileSyncItem[]) {
  const userId = store.profiles.userId;
  if (!userId) throw new Error('E_UNAUTHORIZED');
  for (const item of items) {
    const repo = repositories(store)[resource];
    const previous = await repo.get(item.id);
    let data: unknown = null;
    if (!item.deleted) {
      if (resource === 'profiles' && 'birth' in item)
        data = {
          name: item.metadata.label,
          relation: item.metadata.relation,
          isDefault: item.isDefault,
          birth: item.birth,
          version: item.version,
          isCurrent: true,
          ...(previous?.data && 'options' in previous.data
            ? { options: previous.data.options }
            : {}),
        };
      if (resource === 'readings' && 'chart' in item) {
        const profile = item.profileId ? await store.profiles.get(item.profileId) : null;
        data = {
          profileId: item.profileId,
          profileVersion: item.profileId
            ? (item.profileVersion ?? profile?.data?.version ?? 1)
            : null,
          system: item.system,
          status: 'ok',
          inputSnapshot: item.request,
          chart: item.chart,
          reportZh: item.reportZh,
          reportEn: item.reportEn,
          schoolUsed: item.schoolUsed,
          engineVersion: item.engineVersion,
          interpretVersion: item.interpretVersion,
          knowledgeVersion: item.knowledgeVersion,
          title: item.title,
          isPublic: false,
        };
      }
      if (resource === 'journal' && 'prediction' in item)
        data = {
          profileId: item.profileId,
          date: item.date,
          mood: item.mood,
          text: item.text,
          tz: item.prediction.tz,
          prediction: item.prediction,
        };
      if (resource === 'settings' && 'settings' in item) {
        const current = (await store.settings.list(1))[0];
        // DESIGN-GAP: Server settings exclude device onboarding/active selection; preserve these device-only values.
        const settings = Object.fromEntries(
          Object.entries(item.settings).filter(([key]) => key !== 'name'),
        );
        data = SettingsSchema.parse({ ...current?.data, ...settings, onboardingVersion: 1 });
        // The local Settings primary key can differ from the server's User.id.
        if (current && current.id !== item.id)
          await store.database.write((sql) =>
            sql.runAsync(
              'UPDATE Settings SET id=? WHERE id=? AND userId=?',
              item.id,
              current.id,
              userId,
            ),
          );
      }
      if (data === null) throw new Error('E_VALIDATION');
    }
    await repo.applyRemote([
      {
        id: item.id,
        userId,
        createdAt:
          'createdAt' in item
            ? new Date(item.createdAt).toISOString()
            : (previous?.createdAt ?? new Date(item.updatedAt).toISOString()),
        updatedAt: new Date(item.updatedAt).toISOString(),
        deletedAt: item.deleted ? new Date(item.updatedAt).toISOString() : null,
        data,
      },
    ]);
  }
}
/** Upload local changes then pull all delta pages, retaining cursors until each page is applied. */
export async function synchronize(manager: SessionManager, locale: MobileLocale, store?: Store) {
  const userId = manager.session?.userId;
  if (!userId) throw new Error('E_UNAUTHORIZED');
  const local = store ?? (await getLocalStore(userId));
  for (const resource of mobileResources) {
    const state = await local.database.read((sql) =>
      sql.getFirstAsync<{ cursor: string | null; uploadedAt: string | null }>(
        'SELECT cursor,uploadedAt FROM MobileSyncState WHERE userId=? AND resource=?',
        userId,
        resource,
      ),
    );
    const rows = await repositories(local)[resource].changes(state?.uploadedAt ?? undefined);
    const last = rows.at(-1)?.updatedAt;
    // DESIGN-GAP: Daily snapshots are deterministic device caches, not ReadingRequest records; the documented reading API excludes daily. Advance their watermark without uploading them.
    const uploads = rows.filter(
      (row) =>
        resource !== 'readings' ||
        !row.data ||
        !('system' in row.data) ||
        row.data.system !== 'daily',
    );
    for (let offset = 0; offset < uploads.length; offset += resource === 'settings' ? 1 : 50) {
      const endpoint = mobilePushEndpoint(resource);
      const payload = endpoint.input.parse({
        items: uploads
          .slice(offset, offset + (resource === 'settings' ? 1 : 50))
          .map((row) => upload(resource, row, userId, locale)),
      });
      const response = await manager.request(endpoint, payload);
      await applyItems(local, resource, response.items);
    }
    let cursor = state?.cursor ?? undefined;
    while (true) {
      const response = await manager.request(
        mobilePullEndpoint(resource),
        cursor ? { since: cursor } : {},
      );
      await applyItems(local, resource, response.items);
      await local.database.write((sql) =>
        sql.runAsync(
          'INSERT INTO MobileSyncState(userId,resource,cursor,uploadedAt) VALUES(?,?,?,?) ON CONFLICT(userId,resource) DO UPDATE SET cursor=excluded.cursor,uploadedAt=excluded.uploadedAt',
          userId,
          resource,
          response.cursor,
          last ?? state?.uploadedAt ?? null,
        ),
      );
      cursor = response.cursor;
      if (!response.hasMore) break;
    }
  }
}
