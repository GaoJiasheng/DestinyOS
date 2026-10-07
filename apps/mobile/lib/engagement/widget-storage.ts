import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import { ExtensionStorage } from '@bacons/apple-targets';
import { WidgetSnapshotSchema, type WidgetSnapshot } from './planner';
const group = 'group.pub.gavin.tianji';
const key = 'tianji.widget.v1';
interface AndroidStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}
/** Publish only presentation fields, then reload native widgets. */
export async function writeWidgetSnapshot(snapshot: WidgetSnapshot) {
  const value = JSON.stringify(snapshot);
  if (Platform.OS === 'ios') {
    new ExtensionStorage(group).set(key, value);
    ExtensionStorage.reloadWidget('TianjiDaily');
  } else if (Platform.OS === 'android') {
    await requireNativeModule<AndroidStorage>('TianjiWidgetStorage').write(value);
    const { updateAndroidWidgets } = await import('../../native/android/widget');
    await updateAndroidWidgets(snapshot);
  }
}
/** Read Android's display snapshot without loading the encrypted birth database. */
export async function readAndroidWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  const raw = await requireNativeModule<AndroidStorage>('TianjiWidgetStorage').read();
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const parsed = WidgetSnapshotSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
/** Immediately erase the former account's display data during identity/profile changes. */
export async function clearWidgetSnapshot() {
  if (Platform.OS === 'ios') {
    new ExtensionStorage(group).remove(key);
    ExtensionStorage.reloadWidget('TianjiDaily');
  } else if (Platform.OS === 'android') {
    await requireNativeModule<AndroidStorage>('TianjiWidgetStorage').clear();
    const { updateAndroidWidgets } = await import('../../native/android/widget');
    await updateAndroidWidgets(null);
  }
}
