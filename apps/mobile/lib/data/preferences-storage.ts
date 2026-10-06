import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { StateStorage } from 'zustand/middleware';
import { getLocalStore } from './store';
import { SettingsSchema } from './models';
/** Zustand only projects theme/locale; the complete settings record stays encrypted in SQLCipher. */
export const encryptedPreferencesStorage: StateStorage = {
  async getItem() {
    const store = await getLocalStore();
    let record = (await store.settings.list(1))[0];
    if (!record) {
      // DESIGN-GAP: One-time migration of M01's non-sensitive UI preferences, then remove
      // the legacy copy only after encrypted persistence succeeds.
      const legacy = await AsyncStorage.getItem('tianji-ui-preferences');
      if (legacy) {
        let raw: unknown;
        try {
          raw = JSON.parse(legacy);
        } catch {
          raw = null;
        }
        const parsed = z
          .object({ state: SettingsSchema.pick({ locale: true, theme: true }) })
          .safeParse(raw);
        if (parsed.success) {
          record = await store.updateSettings(parsed.data.state);
          await AsyncStorage.removeItem('tianji-ui-preferences');
        }
      }
    }
    return record?.data
      ? JSON.stringify({
          state: { locale: record.data.locale, theme: record.data.theme },
          version: 0,
        })
      : null;
  },
  async setItem(_name, value) {
    const raw: unknown = JSON.parse(value);
    const projection = z
      .object({ state: SettingsSchema.pick({ locale: true, theme: true }) })
      .parse(raw);
    await (await getLocalStore()).updateSettings(projection.state);
  },
  async removeItem() {
    const store = await getLocalStore();
    const previous = (await store.settings.list(1))[0];
    if (previous) await store.settings.delete(previous.id);
  },
};
