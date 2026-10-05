import { platform } from './environment';
import { cloudflareBindings } from './cloudflare';
import * as nodeStorage from './storage-node';
import { EXPORT_TTL } from '../report-export-schema';
const path = (key: string) => `report-exports/${key}`;
/** Read a private export and enforce its 24h expiry before returning bytes. */
export async function readExport(key: string): Promise<Uint8Array | null> {
  if (platform() !== 'cloudflare') return nodeStorage.readExport(key);
  const bucket = (await cloudflareBindings()).EXPORT_BUCKET;
  const object = await bucket.get(path(key));
  if (!object) return null;
  const expires = Number(object.customMetadata?.expires);
  if (!Number.isFinite(expires) || expires <= Date.now()) {
    await bucket.delete(path(key));
    return null;
  }
  return new Uint8Array(await object.arrayBuffer());
}
/** Write only to a private bucket; downloads still pass through authenticated application routes. */
export async function writeExport(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<void> {
  if (platform() !== 'cloudflare') return nodeStorage.writeExport(key, data, contentType);
  await (
    await cloudflareBindings()
  ).EXPORT_BUCKET.put(path(key), data, {
    httpMetadata: { contentType, cacheControl: 'private, no-store' },
    customMetadata: { expires: String(Date.now() + EXPORT_TTL * 1000) },
  });
}
