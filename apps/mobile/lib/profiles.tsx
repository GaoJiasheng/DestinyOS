import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { currentOwner, subscribeOwner } from './account/scope';
import { getLocalStore } from './data/store';
import { SettingsSchema, type LocalRecord, type Profile, type Settings } from './data/models';

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
}
const Context = createContext<ProfilesState | null>(null);
/** One reactive projection of encrypted local profiles/settings, shared across native routes. */
export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(() => SettingsSchema.parse({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const store = await getLocalStore();
      const [list, saved] = await Promise.all([store.profiles.list(500), store.settings.list(1)]);
      setProfiles(list);
      setSettings(saved[0]?.data ?? SettingsSchema.parse({}));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return subscribeOwner(() => {
      void reload();
    });
  }, [reload]);
  async function updateSettings(patch: Partial<Settings>) {
    const saved = await (await getLocalStore()).updateSettings(patch);
    if (saved.data) setSettings(saved.data);
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
      const store = await getLocalStore();
      // DESIGN-GAP: Save and active selection in one SQLCipher transaction so interrupted
      // creation never leaves the profile selector pointing at an incomplete record.
      const saved = await store.database.write(async (sql) => {
        const record = await store.profiles.saveInTransaction(sql, profile, id);
        const previous = await sql.getFirstAsync<{ id: string; data: string }>(
          'SELECT id,data FROM Settings WHERE userId IS ? AND deletedAt IS NULL',
          currentOwner(),
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
        return record;
      });
      setProfiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSettings((current) => ({ ...current, activeProfileId: saved.id }));
    },
    async remove(id) {
      await (await getLocalStore()).profiles.delete(id);
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
