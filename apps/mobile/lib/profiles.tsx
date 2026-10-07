import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { currentOwner, subscribeOwner } from './account/scope';
import { getLocalStore } from './data/store';
import {
  SettingsSchema,
  ProfileSchema,
  type LocalRecord,
  type Profile,
  type Settings,
} from './data/models';

type ProfileRecord = LocalRecord<Profile>;
interface ProfilesState {
  profiles: ProfileRecord[];
  active: ProfileRecord | null;
  settings: Settings;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  save: (profile: Profile, id?: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
}
const Context = createContext<ProfilesState | null>(null);
/** One reactive projection of encrypted local profiles/settings, shared across native routes. */
export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(() => SettingsSchema.parse({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const owner = currentOwner(),
      version = ++generation.current;
    setLoading(true);
    setError(false);
    try {
      const store = await getLocalStore(owner);
      const [list, saved] = await Promise.all([store.profiles.list(500), store.settings.list(1)]);
      if (owner !== currentOwner() || version !== generation.current) return;
      setProfiles(list);
      setSettings(saved[0]?.data ?? SettingsSchema.parse({}));
    } catch {
      if (owner === currentOwner() && version === generation.current) setError(true);
    } finally {
      if (owner === currentOwner() && version === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return subscribeOwner(() => {
      // DESIGN-GAP: Bind pending work to its initial owner and clear projections before an account-switch reload.
      setProfiles([]);
      setSettings(SettingsSchema.parse({}));
      void reload();
    });
  }, [reload]);
  async function updateSettings(patch: Partial<Settings>) {
    const owner = currentOwner();
    const saved = await (await getLocalStore(owner)).updateSettings(patch);
    if (saved.data && owner === currentOwner()) setSettings(saved.data);
  }
  const value: ProfilesState = {
    profiles,
    settings,
    loading,
    error,
    reload,
    active:
      profiles.find((profile) => profile.id === settings.activeProfileId) ??
      profiles.find((profile) => profile.data?.isDefault) ??
      profiles[0] ??
      null,
    updateSettings,
    async select(id) {
      await updateSettings({ activeProfileId: id });
    },
    async save(profile, id) {
      const owner = currentOwner(),
        store = await getLocalStore(owner);
      // DESIGN-GAP: Save and active selection in one SQLCipher transaction so interrupted
      // creation never leaves the profile selector pointing at an incomplete record.
      const saved = await store.database.write(async (sql) => {
        if (owner !== currentOwner()) throw new Error('E_FORBIDDEN');
        const count = await sql.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) count FROM BirthProfile WHERE userId IS ? AND deletedAt IS NULL',
          owner,
        );
        const existing = id
          ? await sql.getFirstAsync<{ id: string }>(
              'SELECT id FROM BirthProfile WHERE id=? AND userId IS ? AND deletedAt IS NULL',
              id,
              owner,
            )
          : null;
        // DESIGN-GAP: Anonymous devices use the documented free quota; authenticated quotas remain authoritative on the server.
        if (!existing && owner === null && (count?.count ?? 0) >= 3)
          throw new Error('E_PROFILE_LIMIT');
        const record = await store.profiles.saveInTransaction(
          sql,
          { ...profile, ...(!existing && !count?.count ? { isDefault: true } : {}) },
          id,
        );
        const previous = await sql.getFirstAsync<{ id: string; data: string }>(
          'SELECT id,data FROM Settings WHERE userId IS ? AND deletedAt IS NULL',
          owner,
        );
        await store.settings.saveInTransaction(
          sql,
          {
            ...(previous
              ? SettingsSchema.parse(JSON.parse(previous.data))
              : SettingsSchema.parse({})),
            activeProfileId: record.id,
          },
          previous?.id,
        );
        if (owner !== currentOwner()) throw new Error('E_FORBIDDEN');
        return record;
      });
      if (owner !== currentOwner()) return;
      setProfiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSettings((current) => ({ ...current, activeProfileId: saved.id }));
    },
    async setDefault(id) {
      const owner = currentOwner(),
        store = await getLocalStore(owner);
      if (!profiles.some((item) => item.id === id)) throw new Error('E_FORBIDDEN');
      // DESIGN-GAP: Default is selection metadata, so switching it advances sync time without changing birth versions.
      await store.database.write(async (sql) => {
        if (owner !== currentOwner()) throw new Error('E_FORBIDDEN');
        const rows = await sql.getAllAsync<{ id: string; data: string; updatedAt: string }>(
          'SELECT id,data,updatedAt FROM BirthProfile WHERE userId IS ? AND deletedAt IS NULL',
          owner,
        );
        if (!rows.some((row) => row.id === id)) throw new Error('E_FORBIDDEN');
        for (const row of rows) {
          const data = ProfileSchema.parse(JSON.parse(row.data));
          const updatedAt = new Date(
            Math.max(Date.now(), Date.parse(row.updatedAt) + 1),
          ).toISOString();
          await sql.runAsync(
            'UPDATE BirthProfile SET data=?,updatedAt=? WHERE id=?',
            JSON.stringify({ ...data, isDefault: row.id === id }),
            updatedAt,
            row.id,
          );
        }
        if (owner !== currentOwner()) throw new Error('E_FORBIDDEN');
      });
      await reload();
    },
    async remove(id) {
      const owner = currentOwner();
      await (await getLocalStore(owner)).profiles.delete(id);
      await reload();
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
/** Read profile state inside the root provider. */
export function useProfiles() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing ProfilesProvider');
  return value;
}
