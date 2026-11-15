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
  /** `activate: false` keeps the current profile (e.g. a partner's chart); the first profile always activates. */
  save: (profile: Profile, id?: string, options?: { activate?: boolean }) => Promise<void>;
  select: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
}
/** Anonymous devices keep at most three local profiles; signed-in quotas are enforced by the server. */
export const anonymousProfileLimit = 3;
const Context = createContext<ProfilesState | null>(null);
/** One reactive projection of encrypted local profiles/settings, shared across native routes. */
export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(() => SettingsSchema.parse({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const loadedOwner = useRef<string | null | undefined>(undefined);
  const reload = useCallback(async () => {
    const owner = currentOwner(),
      version = ++generation.current;
    // DESIGN-GAP: A same-owner sync refresh keeps existing screens/sheets mounted; initial hydration, identity changes and cipher recovery still gate all private content.
    if (loadedOwner.current !== owner) setLoading(true);
    setError(false);
    try {
      const store = await getLocalStore(owner);
      const [list, saved] = await Promise.all([store.profiles.list(500), store.settings.list(1)]);
      if (owner !== currentOwner() || version !== generation.current) return;
      loadedOwner.current = owner;
      setProfiles(list);
      setSettings(saved[0]?.data ?? SettingsSchema.parse({}));
    } catch {
      if (owner === currentOwner() && version === generation.current) {
        loadedOwner.current = undefined;
        setError(true);
      }
    } finally {
      if (owner === currentOwner() && version === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return subscribeOwner(() => {
      // DESIGN-GAP: Bind pending work to its initial owner and clear projections before an account-switch reload.
      if (loadedOwner.current !== currentOwner()) {
        loadedOwner.current = undefined;
        setProfiles([]);
        setSettings(SettingsSchema.parse({}));
      }
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
    async save(profile, id, options) {
      const owner = currentOwner(),
        store = await getLocalStore(owner);
      // DESIGN-GAP: Save and active selection in one SQLCipher transaction so interrupted
      // creation never leaves the profile selector pointing at an incomplete record.
      const result = await store.database.write(async (sql) => {
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
        if (!existing && owner === null && (count?.count ?? 0) >= anonymousProfileLimit)
          throw new Error('E_PROFILE_LIMIT');
        const record = await store.profiles.saveInTransaction(
          sql,
          { ...profile, ...(!existing && !count?.count ? { isDefault: true } : {}) },
          id,
        );
        const activate = options?.activate !== false || (!existing && !count?.count);
        if (!activate) {
          if (owner !== currentOwner()) throw new Error('E_FORBIDDEN');
          return { record, activated: false };
        }
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
        return { record, activated: true };
      });
      if (owner !== currentOwner()) return;
      const { record: saved, activated } = result;
      setProfiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      if (activated) setSettings((current) => ({ ...current, activeProfileId: saved.id }));
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
/** The name to show for a profile ("{name}'s day"); unnamed profiles fall back to the caller's label. */
export function profileDisplayName(profile: ProfileRecord | null | undefined, fallback: string) {
  return profile?.data?.name?.trim() || fallback;
}
/** True when an anonymous device already holds its full local profile quota. */
export function profileLimitReached(profiles: readonly ProfileRecord[]) {
  return currentOwner() === null && profiles.length >= anonymousProfileLimit;
}
